import '@/services/fallWatchdogTask';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { FallCountdownOverlay } from '@/components/FallCountdownOverlay';
import { Colors } from '@/constants/theme';
import { BackgroundFallService } from '@/services/BackgroundFallService';
import { FallDetectionService } from '@/services/FallDetectionService';
import { NotificationService } from '@/services/NotificationService';
import { VoiceTriggerService } from '@/services/VoiceTriggerService';
import { useAppStore } from '@/store/appStore';
import { useFallAlertStore } from '@/store/fallAlertStore';

export default function RootLayout() {
  const medicines = useAppStore((s) => s.medicines);
  const sensors = useAppStore((s) => s.settings.sensors);
  const onboardingCompleted = useAppStore((s) => s.onboardingCompleted);

  useEffect(() => {
    if (!onboardingCompleted) return;
    void NotificationService.scheduleMedicineReminders(medicines);
  }, [medicines, onboardingCompleted]);

  useEffect(() => {
    if (!onboardingCompleted) return;
    let cleanup: (() => void) | undefined;
    void NotificationService.attachListeners().then((fn) => {
      cleanup = fn;
    });
    return () => cleanup?.();
  }, [onboardingCompleted]);

  /**
   * Koruma servisi — onboarding sonrası HER ZAMAN çalışır (uygulama kapalıyken de).
   * Düşme kapalı olsa bile İMDAT dinleme FGS içinde devam eder.
   * Arka planda VoiceTrigger STOP ETME — önceki hata buydu.
   */
  useEffect(() => {
    if (!onboardingCompleted) {
      void BackgroundFallService.stop();
      void VoiceTriggerService.stop();
      return;
    }

    void BackgroundFallService.start({
      sensitivity: sensors.fallSensitivity,
      countdownSeconds: sensors.fallCountdownSeconds,
      fallDetectionEnabled: sensors.fallDetectionEnabled,
    });

    const onAppState = (state: AppStateStatus) => {
      if (state !== 'active') return;

      // Servis ölmüşse (OEM öldürmüş olabilir) yeniden başlat
      if (!BackgroundFallService.isRunning()) {
        void BackgroundFallService.start({
          sensitivity: useAppStore.getState().settings.sensors.fallSensitivity,
          countdownSeconds:
            useAppStore.getState().settings.sensors.fallCountdownSeconds,
          fallDetectionEnabled:
            useAppStore.getState().settings.sensors.fallDetectionEnabled,
        });
        return;
      }

      // Overlay yokken ses düştüyse toparla
      if (
        !useFallAlertStore.getState().active &&
        VoiceTriggerService.getMode() === 'off'
      ) {
        void VoiceTriggerService.startEmergencyMode(() => {
          const seconds =
            useAppStore.getState().settings.sensors.fallCountdownSeconds ?? 10;
          FallDetectionService.openFallCountdown(
            seconds,
            'Sesli imdat komutu algılandı'
          );
        });
      }
    };

    const sub = AppState.addEventListener('change', onAppState);

    return () => {
      sub.remove();
      // Root unmount / ayar değişiminde yeniden start edilecek — burada stop etme
      // (stop, onboarding kapanınca veya explicit disable'da yapılır)
    };
  }, [
    onboardingCompleted,
    sensors.fallDetectionEnabled,
    sensors.fallSensitivity,
    sensors.fallCountdownSeconds,
  ]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.bg },
          animation: 'slide_from_right',
        }}
      />
      <FallCountdownOverlay />
    </GestureHandlerRootView>
  );
}
