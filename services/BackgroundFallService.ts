import { AppState, Linking, Platform } from 'react-native';
import {
  cancelGuardianAlert,
  isGuardianRunning,
  startGuardian,
  stopGuardian,
  syncGuardianConfig,
} from 'guardian-native';

import {
  FallDetectionService,
  type FallSensitivity,
} from '@/services/FallDetectionService';
import { VoiceTriggerService } from '@/services/VoiceTriggerService';
import { SosService } from '@/services/SosService';
import { useAppStore } from '@/store/appStore';
import { useFallAlertStore } from '@/store/fallAlertStore';

type MonitorOptions = {
  sensitivity?: FallSensitivity;
  countdownSeconds?: number;
  fallDetectionEnabled?: boolean;
};

let foregroundUnsubscribe: (() => void) | null = null;
let appStateSub: { remove: () => void } | null = null;

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
    'Sesli imdat komutu algılandı'
  );
  void Linking.openURL('yasliasistani://');
}

async function pushNativeConfig(options?: MonitorOptions): Promise<void> {
  if (Platform.OS !== 'android') return;

  const state = useAppStore.getState();
  const phones = SosService.collectPhones(state.emergencyContacts);
  const primary =
    SosService.pickPrimaryPhone(state.emergencyContacts) ?? phones[0] ?? '';

  await syncGuardianConfig({
    enabled: true,
    fallEnabled:
      options?.fallDetectionEnabled ?? state.settings.sensors.fallDetectionEnabled,
    voiceEnabled: true,
    sensitivity:
      options?.sensitivity ?? state.settings.sensors.fallSensitivity ?? 'medium',
    countdownSeconds:
      options?.countdownSeconds ??
      state.settings.sensors.fallCountdownSeconds ??
      10,
    phones: phones.join(','),
    primaryPhone: primary,
    message: state.settings.emergencyMessage,
  });
}

/**
 * Android: native GuardianForegroundService (uygulama öldürülse bile çalışır).
 * iOS / fallback: ön plan sensör + ses.
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
        await pushNativeConfig(options);
        await startGuardian();
        // Ön plandayken de JS ses yedek (native asıl kaynak)
        if (!useFallAlertStore.getState().active) {
          await VoiceTriggerService.startEmergencyMode(onVoiceEmergency);
        }
        return;
      } catch (error) {
        console.warn('[BackgroundFallService] Native guardian failed', error);
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
      if (state === 'active' && !useFallAlertStore.getState().active) {
        if (useAppStore.getState().settings.sensors.fallDetectionEnabled) {
          foregroundUnsubscribe?.();
          foregroundUnsubscribe = FallDetectionService.start(
            onFallDetected,
            sensitivity
          );
        }
        void VoiceTriggerService.startEmergencyMode(onVoiceEmergency);
      }
    });
  },

  async stop(): Promise<void> {
    foregroundUnsubscribe?.();
    foregroundUnsubscribe = null;
    appStateSub?.remove();
    appStateSub = null;
    FallDetectionService.stop();

    if (Platform.OS === 'android') {
      try {
        await stopGuardian();
      } catch {
        // ignore
      }
    }
  },

  async cancelNativeAlert(): Promise<void> {
    if (Platform.OS !== 'android') return;
    try {
      await cancelGuardianAlert();
    } catch {
      // ignore
    }
  },

  async syncPhones(): Promise<void> {
    if (Platform.OS !== 'android') return;
    try {
      await pushNativeConfig();
      if (!isGuardianRunning()) {
        await startGuardian();
      }
    } catch {
      // ignore
    }
  },

  isRunning(): boolean {
    if (Platform.OS === 'android') {
      try {
        return isGuardianRunning();
      } catch {
        return false;
      }
    }
    return foregroundUnsubscribe != null || VoiceTriggerService.isListening();
  },
};
