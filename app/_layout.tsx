import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { FallCountdownOverlay } from '@/components/FallCountdownOverlay';
import { Colors } from '@/constants/theme';
import { FallDetectionService } from '@/services/FallDetectionService';
import { NotificationService } from '@/services/NotificationService';
import { VoiceTriggerService } from '@/services/VoiceTriggerService';
import { useAppStore } from '@/store/appStore';
import { useFallAlertStore } from '@/store/fallAlertStore';

export default function RootLayout() {
  const medicines = useAppStore((s) => s.medicines);
  const sensors = useAppStore((s) => s.settings.sensors);

  useEffect(() => {
    void NotificationService.scheduleMedicineReminders(medicines);
  }, [medicines]);

  // Düşme algılama (ivmeölçer)
  useEffect(() => {
    if (!sensors.fallDetectionEnabled) {
      FallDetectionService.stop();
      return;
    }

    const stop = FallDetectionService.start(() => {
      FallDetectionService.openFallCountdown(
        sensors.fallCountdownSeconds ?? 10,
        'Şiddetli ivme / olası düşme tespit edildi'
      );
    }, sensors.fallSensitivity);

    return stop;
  }, [
    sensors.fallDetectionEnabled,
    sensors.fallSensitivity,
    sensors.fallCountdownSeconds,
  ]);

  // Normal mod: sesli İMDAT / YARDIM / SOS dinleme
  useEffect(() => {
    let disposed = false;

    const startEmergency = () => {
      if (disposed) return;
      if (useFallAlertStore.getState().active) return;
      void VoiceTriggerService.startEmergencyMode(() => {
        FallDetectionService.openFallCountdown(
          useAppStore.getState().settings.sensors.fallCountdownSeconds ?? 10,
          'Sesli imdat komutu algılandı'
        );
      });
    };

    startEmergency();

    const onAppState = (state: AppStateStatus) => {
      if (state === 'active') {
        startEmergency();
      } else if (state === 'background' || state === 'inactive') {
        // Arka planda sürekli tanıma çoğu cihazda kısıtlı; kaynakları bırak
        void VoiceTriggerService.stop();
      }
    };

    const sub = AppState.addEventListener('change', onAppState);

    return () => {
      disposed = true;
      sub.remove();
      void VoiceTriggerService.stop();
    };
  }, []);

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
