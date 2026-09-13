import { Accelerometer } from 'expo-sensors';
import { AppState, Linking, PermissionsAndroid, Platform } from 'react-native';
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

  void Linking.openURL('yasliasistani://');
}

/** Android 14+ health FGS için ACTIVITY_RECOGNITION şart. */
async function ensureActivityRecognition(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
      {
        title: 'Hareket izni',
        message: 'Düşme algılama için fiziksel aktivite izni gerekir.',
        buttonPositive: 'İzin ver',
        buttonNegative: 'Hayır',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

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
  // specialUse yeterli; health tipi ekstra sensor izinleri istiyor (SDK 36)
  foregroundServiceType: ['specialUse'] as 'specialUse'[],
};

export const BackgroundFallService = {
  async start(options?: MonitorOptions): Promise<void> {
    await this.stop();

    const sensitivity =
      options?.sensitivity ??
      useAppStore.getState().settings.sensors.fallSensitivity ??
      'medium';

    if (Platform.OS === 'android') {
      try {
        await ensureActivityRecognition();
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
