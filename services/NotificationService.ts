import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { Medicine } from '@/types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function parseTimeToHourMinute(time: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

export const NotificationService = {
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('medicines', {
        name: 'İlaç Hatırlatmaları',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#E11D2E',
      });
    }

    if (!Device.isDevice && Platform.OS === 'web') {
      return false;
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;

    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  },

  async scheduleMedicineReminders(medicines: Medicine[]): Promise<void> {
    const granted = await this.requestPermissions();
    if (!granted) return;

    await Notifications.cancelAllScheduledNotificationsAsync();

    for (const medicine of medicines) {
      if (!medicine.enabled) continue;

      for (const time of medicine.times) {
        const parsed = parseTimeToHourMinute(time);
        if (!parsed) continue;

        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'İlaç Hatırlatması',
            body: `${medicine.name} — ${medicine.dosage}`,
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
            ...(Platform.OS === 'android' ? { channelId: 'medicines' } : {}),
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: parsed.hour,
            minute: parsed.minute,
          },
        });
      }
    }
  },

  async sendImmediateAlert(title: string, body: string): Promise<void> {
    await this.requestPermissions();
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null,
    });
  },
};
