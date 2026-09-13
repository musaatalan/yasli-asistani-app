import { Accelerometer } from 'expo-sensors';
import { AppState, Linking, PermissionsAndroid, Platform } from 'react-native';
import BackgroundService from 'react-native-background-actions';

import {
  FallDetectionService,
  type FallSensitivity,
} from '@/services/FallDetectionService';
import { VoiceTriggerService } from '@/services/VoiceTriggerService';
import { useAppStore } from '@/store/appStore';
import { useFallAlertStore } from '@/store/fallAlertStore';

const TASK_NAME = 'YasliAsistaniGuardian';

type MonitorOptions = {
  sensitivity?: FallSensitivity;
  countdownSeconds?: number;
  fallDetectionEnabled?: boolean;
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

function onVoiceEmergency() {
  if (useFallAlertStore.getState().active) return;
  const seconds =
    useAppStore.getState().settings.sensors.fallCountdownSeconds ?? 10;
  FallDetectionService.openFallCountdown(
    seconds,
    'Sesli imdat komutu algılandı (arka plan)'
  );
  void Linking.openURL('yasliasistani://');
}

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

/**
 * Foreground service JS döngüsü — uygulama kapalıyken de:
 * - düşme sensörü (açıksa)
 * - İMDAT / YARDIM ses dinleme
 */
async function guardianTask(taskData?: MonitorOptions) {
  const sensitivity =
    taskData?.sensitivity ??
    useAppStore.getState().settings.sensors.fallSensitivity ??
    'medium';

  const fallEnabled =
    taskData?.fallDetectionEnabled ??
    useAppStore.getState().settings.sensors.fallDetectionEnabled;

  let accelSub: { remove: () => void } | null = null;

  if (fallEnabled) {
    Accelerometer.setUpdateInterval(50);
    accelSub = Accelerometer.addListener(({ x, y, z }) => {
      FallDetectionService.processSample(x, y, z, onFallDetected, sensitivity);
    });
  }

  // Arka planda İMDAT — FGS + microphone tipi ile canlı kalır
  if (!useFallAlertStore.getState().active) {
    await VoiceTriggerService.startEmergencyMode(onVoiceEmergency);
  }

  try {
    while (BackgroundService.isRunning()) {
      // Ses dinleme düştüyse ve overlay yoksa yeniden başlat
      if (
        !useFallAlertStore.getState().active &&
        VoiceTriggerService.getMode() === 'off'
      ) {
        await VoiceTriggerService.startEmergencyMode(onVoiceEmergency);
      }

      // Düşme ayarı runtime'da açıldıysa sensörü bağla
      const enabledNow =
        useAppStore.getState().settings.sensors.fallDetectionEnabled;
      if (enabledNow && !accelSub) {
        const sens =
          useAppStore.getState().settings.sensors.fallSensitivity ?? 'medium';
        Accelerometer.setUpdateInterval(50);
        accelSub = Accelerometer.addListener(({ x, y, z }) => {
          FallDetectionService.processSample(x, y, z, onFallDetected, sens);
        });
      } else if (!enabledNow && accelSub) {
        accelSub.remove();
        accelSub = null;
      }

      await sleep(2000);
    }
  } finally {
    accelSub?.remove();
    // Servis dururken sesi de kes — yeniden start dışarıdan gelir
  }
}

const notificationOptions = {
  taskName: TASK_NAME,
  taskTitle: 'Koruma aktif',
  taskDesc: 'İmdat dinleniyor · düşme koruması açık',
  taskIcon: {
    name: 'ic_launcher',
    type: 'mipmap',
  },
  color: '#E11D2E',
  linkingURI: 'yasliasistani://',
  // microphone: arka planda İMDAT; specialUse: düşme izleme
  foregroundServiceType: ['microphone', 'specialUse'] as (
    | 'microphone'
    | 'specialUse'
  )[],
};

/**
 * Uygulama kapalıyken koruma — Android kalıcı bildirimli FGS.
 * Bildirim çubuğunda "Koruma aktif" görünmeli; bu servis durursa İMDAT çalışmaz.
 */
export const BackgroundFallService = {
  async start(options?: MonitorOptions): Promise<void> {
    await this.stop();

    const sensitivity =
      options?.sensitivity ??
      useAppStore.getState().settings.sensors.fallSensitivity ??
      'medium';
    const fallDetectionEnabled =
      options?.fallDetectionEnabled ??
      useAppStore.getState().settings.sensors.fallDetectionEnabled;

    if (Platform.OS === 'android') {
      try {
        await ensureActivityRecognition();
        await VoiceTriggerService.requestPermission();
        await BackgroundService.start(guardianTask, {
          ...notificationOptions,
          parameters: { sensitivity, fallDetectionEnabled },
        });
        return;
      } catch (error) {
        console.warn(
          '[BackgroundFallService] FGS başlatılamadı, ön plan moduna düşülüyor',
          error
        );
      }
    }

    if (fallDetectionEnabled) {
      foregroundUnsubscribe = FallDetectionService.start(
        onFallDetected,
        sensitivity
      );
    }
    await VoiceTriggerService.startEmergencyMode(onVoiceEmergency);

    appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !FallDetectionService.isAlertPaused()) {
        if (
          useAppStore.getState().settings.sensors.fallDetectionEnabled
        ) {
          foregroundUnsubscribe?.();
          foregroundUnsubscribe = FallDetectionService.start(
            onFallDetected,
            sensitivity
          );
        }
        if (!useFallAlertStore.getState().active) {
          void VoiceTriggerService.startEmergencyMode(onVoiceEmergency);
        }
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
    return foregroundUnsubscribe != null || VoiceTriggerService.isListening();
  },
};
