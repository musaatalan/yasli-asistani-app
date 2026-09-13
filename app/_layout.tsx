import '@/services/fallWatchdogTask';

import * as Linking from 'expo-linking';
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

function handleGuardianDeepLink(url: string | null) {
  if (!url) return;
  try {
    const parsed = Linking.parse(url);
    const host = parsed.hostname ?? '';
    const path = `${parsed.path ?? ''}`.replace(/^\//, '');
    if (host === 'countdown' || path === 'countdown' || path.startsWith('countdown')) {
      const reason =
        (parsed.queryParams?.reason as string) || 'Acil durum algılandı';
      const seconds = Number(parsed.queryParams?.seconds ?? 10) || 10;
      FallDetectionService.openFallCountdown(seconds, reason, true);
    }
  } catch (error) {
    console.warn('[DeepLink]', error);
  }
}

export default function RootLayout() {
  const medicines = useAppStore((s) => s.medicines);
  const sensors = useAppStore((s) => s.settings.sensors);
  const onboardingCompleted = useAppStore((s) => s.onboardingCompleted);
  const emergencyContacts = useAppStore((s) => s.emergencyContacts);

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

  // Native guardian deep link (uygulama kapalıyken tetik)
  useEffect(() => {
    void Linking.getInitialURL().then(handleGuardianDeepLink);
    const sub = Linking.addEventListener('url', ({ url }) => {
      handleGuardianDeepLink(url);
    });
    return () => sub.remove();
  }, []);

  /**
   * Native GuardianForegroundService — uygulama öldürülse bile çalışır.
   * Bildirim: "Koruma aktif". Recent'ten kaydırınca da onTaskRemoved ile kalkar.
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
      if (!BackgroundFallService.isRunning()) {
        void BackgroundFallService.start({
          sensitivity: useAppStore.getState().settings.sensors.fallSensitivity,
          countdownSeconds:
            useAppStore.getState().settings.sensors.fallCountdownSeconds,
          fallDetectionEnabled:
            useAppStore.getState().settings.sensors.fallDetectionEnabled,
        });
      } else {
        void BackgroundFallService.syncPhones();
      }
    };

    const sub = AppState.addEventListener('change', onAppState);
    return () => sub.remove();
  }, [
    onboardingCompleted,
    sensors.fallDetectionEnabled,
    sensors.fallSensitivity,
    sensors.fallCountdownSeconds,
    emergencyContacts,
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
