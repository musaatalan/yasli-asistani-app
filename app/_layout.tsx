import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { FallCountdownOverlay } from '@/components/FallCountdownOverlay';
import { Colors } from '@/constants/theme';
import { FallDetectionService } from '@/services/FallDetectionService';
import { NotificationService } from '@/services/NotificationService';
import { useAppStore } from '@/store/appStore';
import { useFallAlertStore } from '@/store/fallAlertStore';

export default function RootLayout() {
  const medicines = useAppStore((s) => s.medicines);
  const sensors = useAppStore((s) => s.settings.sensors);
  const startCountdown = useFallAlertStore((s) => s.startCountdown);

  useEffect(() => {
    void NotificationService.scheduleMedicineReminders(medicines);
  }, [medicines]);

  useEffect(() => {
    if (!sensors.fallDetectionEnabled) {
      FallDetectionService.stop();
      return;
    }

    const stop = FallDetectionService.start(() => {
      startCountdown(
        sensors.fallCountdownSeconds ?? 10,
        'Şiddetli ivme / olası düşme tespit edildi'
      );
    }, sensors.fallSensitivity);

    return stop;
  }, [
    sensors.fallDetectionEnabled,
    sensors.fallSensitivity,
    sensors.fallCountdownSeconds,
    startCountdown,
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
