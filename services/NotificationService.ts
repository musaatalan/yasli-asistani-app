import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { SosService } from '@/services/SosService';
import { useAppStore } from '@/store/appStore';
import type { Medicine } from '@/types';

const MEDICINE_CATEGORY = 'medicine_actions';
const GRACE_MINUTES = 15;

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

function addMinutes(hour: number, minute: number, add: number) {
  const total = hour * 60 + minute + add;
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  return { hour: Math.floor(wrapped / 60), minute: wrapped % 60 };
}

async function ensureChannelsAndCategory(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('medicines', {
      name: 'İlaç Hatırlatmaları',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#E11D2E',
    });
    await Notifications.setNotificationChannelAsync('medicine_missed', {
      name: 'İlaç Kaçırma',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 400, 200, 400],
      lightColor: '#E11D2E',
    });
  }

  await Notifications.setNotificationCategoryAsync(MEDICINE_CATEGORY, [
    {
      identifier: 'taken',
      buttonTitle: 'Aldım',
      options: { opensAppToForeground: true },
    },
    {
      identifier: 'notify_contact',
      buttonTitle: 'Yakını bilgilendir',
      options: { opensAppToForeground: true },
    },
  ]);
}

export const NotificationService = {
  async requestPermissions(): Promise<boolean> {
    await ensureChannelsAndCategory();

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

        const remindId = `med-${medicine.id}-${time}-remind`;
        const missedId = `med-${medicine.id}-${time}-missed`;
        const missedAt = addMinutes(parsed.hour, parsed.minute, GRACE_MINUTES);

        await Notifications.scheduleNotificationAsync({
          identifier: remindId,
          content: {
            title: 'İlaç Hatırlatması',
            body: `${medicine.name} — ${medicine.dosage}`,
            sound: true,
            categoryIdentifier: MEDICINE_CATEGORY,
            data: {
              type: 'medicine_reminder',
              medicineId: medicine.id,
              name: medicine.name,
              dosage: medicine.dosage,
              time,
              missedId,
            },
            priority: Notifications.AndroidNotificationPriority.HIGH,
            ...(Platform.OS === 'android' ? { channelId: 'medicines' } : {}),
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: parsed.hour,
            minute: parsed.minute,
          },
        });

        await Notifications.scheduleNotificationAsync({
          identifier: missedId,
          content: {
            title: 'İlaç alınmadı olabilir',
            body: `${medicine.name} için ${GRACE_MINUTES} dk geçti. Yakınınıza haber vermek için dokunun.`,
            sound: true,
            categoryIdentifier: MEDICINE_CATEGORY,
            data: {
              type: 'medicine_missed',
              medicineId: medicine.id,
              name: medicine.name,
              dosage: medicine.dosage,
              time,
            },
            priority: Notifications.AndroidNotificationPriority.MAX,
            ...(Platform.OS === 'android'
              ? { channelId: 'medicine_missed' }
              : {}),
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: missedAt.hour,
            minute: missedAt.minute,
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

  /** Bildirim aksiyonu / dokunma — ilaç alındı veya yakını SMS. */
  async handleNotificationResponse(
    response: Notifications.NotificationResponse
  ): Promise<void> {
    const data = response.notification.request.content.data as {
      type?: string;
      name?: string;
      dosage?: string;
      missedId?: string;
    };
    const action = response.actionIdentifier;

    if (action === 'taken') {
      if (data.missedId) {
        try {
          await Notifications.cancelScheduledNotificationAsync(data.missedId);
        } catch {
          // ignore
        }
      }
      return;
    }

    if (action === 'notify_contact') {
      await this.notifyMissedMedicineToContacts(
        data.name ?? 'İlaç',
        data.dosage ?? ''
      );
      return;
    }

    // Bildirime dokunma
    if (
      action === Notifications.DEFAULT_ACTION_IDENTIFIER &&
      data.type === 'medicine_missed'
    ) {
      await this.notifyMissedMedicineToContacts(
        data.name ?? 'İlaç',
        data.dosage ?? ''
      );
    }
  },

  async notifyMissedMedicineToContacts(
    name: string,
    dosage: string
  ): Promise<void> {
    const contacts = useAppStore.getState().emergencyContacts;
    const opened = await SosService.openMissedMedicineSms(contacts, name, dosage);
    if (!opened) {
      await this.sendImmediateAlert(
        'Yakın bilgilendirilemedi',
        'Acil telefon numarası yok. Ayarlardan ekleyin.'
      );
    }
  },

  async attachListeners(): Promise<() => void> {
    await ensureChannelsAndCategory();

    const subResponse = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        void this.handleNotificationResponse(response);
      }
    );

    const subReceived = Notifications.addNotificationReceivedListener(
      (notification) => {
        const data = notification.request.content.data as { type?: string };
        // Ön plandayken kaçırma bildirimi gelirse otomatik SMS açma — kullanıcı onaylı aksiyon daha iyi
        if (data.type === 'medicine_missed') {
          // sadece göster; kullanıcı dokununca SMS
        }
      }
    );

    const last = await Notifications.getLastNotificationResponseAsync();
    if (last) {
      void this.handleNotificationResponse(last);
    }

    return () => {
      subResponse.remove();
      subReceived.remove();
    };
  },
};
