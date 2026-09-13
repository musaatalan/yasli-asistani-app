import { Accelerometer } from 'expo-sensors';
import { AppState, Linking, Platform } from 'react-native';
import BackgroundService from 'react-native-background-actions';

import {
  FallDetectionService,
  type FallSensitivity,
} from '@/services/FallDetectionService';
import { useAppStore } from '@/store/appStore';

const TASK_NAME = 'YasliAsistaniFallMonitor';

type MonitorOptions = {
  sensitivity?: FallSensitivity;
  countdownSeconds?: number;
};

let foregroundUnsubscribe: (() => void) | null = null;
let appStateSub: { remove: () => void } | null = null;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function onFallDetected() {
  const seconds =
    useAppStore.getState().settings.sensors.fallCountdownSeconds ?? 10;

  FallDetectionService.openFallCountdown(
    seconds,
    'Düşme algılandı (serbest düşüş + darbe + hareketsizlik)'
  );

  // Arka plandaysa uygulamayı öne getir (overlay görünsün)
  void Linking.openURL('yasliasistani://');
}

/**
 * Android foreground service içinde ivmeölçer dinler.
 * Ekran kilitliyken / uygulama arka plandayken JS sürecini canlı tutar.
 */
async function fallMonitorTask(taskData?: MonitorOptions) {
  const sensitivity =
    taskData?.sensitivity ??
    useAppStore.getState().settings.sensors.fallSensitivity ??
    'medium';

  Accelerometer.setUpdateInterval(50);
  const sub = Accelerometer.addListener(({ x, y, z }) => {
    FallDetectionService.processSample(x, y, z, onFallDetected, sensitivity);
  });

  try {
    // Servis çalıştığı sürece bekle
    while (BackgroundService.isRunning()) {
      await sleep(1000);
    }
  } finally {
    sub.remove();
  }
}

const notificationOptions = {
  taskName: TASK_NAME,
  taskTitle: 'Düşme Algılama Aktif',
  taskDesc: 'Güvenli Yaşlı Asistanı arka planda sizi koruyor',
  taskIcon: {
    name: 'ic_launcher',
    type: 'mipmap',
  },
  color: '#E11D2E',
  linkingURI: 'yasliasistani://',
  foregroundServiceType: ['health', 'specialUse'] as (
    | 'health'
    | 'specialUse'
  )[],
};

/**
 * Arka plan düşme izleme — Android'de kalıcı bildirimli foreground service.
 * iOS'ta yalnızca uygulama aktif/background kısa süre için sensör dinler.
 */
export const BackgroundFallService = {
  async start(options?: MonitorOptions): Promise<void> {
    await this.stop();

    const sensitivity =
      options?.sensitivity ??
      useAppStore.getState().settings.sensors.fallSensitivity ??
      'medium';

    if (Platform.OS === 'android') {
      try {
        await BackgroundService.start(fallMonitorTask, {
          ...notificationOptions,
          parameters: { sensitivity },
        });
        return;
      } catch (error) {
        console.warn(
          '[BackgroundFallService] Foreground service başlatılamadı, ön plan dinlemeye düşülüyor',
          error
        );
      }
    }

    // iOS / fallback: klasik ön plan dinleyici + app state ile yeniden bağla
    foregroundUnsubscribe = FallDetectionService.start(onFallDetected, sensitivity);

    appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !FallDetectionService.isAlertPaused()) {
        foregroundUnsubscribe?.();
        foregroundUnsubscribe = FallDetectionService.start(
          onFallDetected,
          sensitivity
        );
      }
    });
  },

  async stop(): Promise<void> {
    foregroundUnsubscribe?.();
    foregroundUnsubscribe = null;
    appStateSub?.remove();
    appStateSub = null;
    FallDetectionService.stop();

    if (Platform.OS === 'android' && BackgroundService.isRunning()) {
      try {
        await BackgroundService.stop();
      } catch {
        // ignore
      }
    }
  },

  isRunning(): boolean {
    if (Platform.OS === 'android') {
      return BackgroundService.isRunning();
    }
    return foregroundUnsubscribe != null;
  },
};
