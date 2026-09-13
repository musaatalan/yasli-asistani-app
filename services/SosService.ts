import * as Haptics from 'expo-haptics';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Linking from 'expo-linking';
import * as SMS from 'expo-sms';
import {
  AppState,
  PermissionsAndroid,
  Platform,
} from 'react-native';

import { getEmergencyLocationText } from '@/services/LocationService';
import type { EmergencyContact, SosResult } from '@/types';

function cleanPhone(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

function collectPhones(contacts: EmergencyContact[]): string[] {
  return contacts
    .map((c) => cleanPhone(c.phone))
    .filter((phone) => phone.replace(/\D/g, '').length >= 7);
}

function pickPrimaryPhone(contacts: EmergencyContact[]): string | null {
  const primary = contacts.find((c) => c.isPrimary && cleanPhone(c.phone));
  if (primary) return cleanPhone(primary.phone);
  const any = contacts.find((c) => cleanPhone(c.phone));
  return any ? cleanPhone(any.phone) : null;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

/** Uygulamayı öne getir — arka plandan Intent engelini aşmak için. */
async function bringAppToForeground(): Promise<void> {
  try {
    await Linking.openURL('yasliasistani://');
  } catch {
    // ignore
  }

  if (AppState.currentState === 'active') return;

  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      sub.remove();
      resolve();
    }, 2500);

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        clearTimeout(timer);
        sub.remove();
        resolve();
      }
    });
  });
}

async function requestCallPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.CALL_PHONE,
      {
        title: 'Arama izni',
        message: 'Acil durumda otomatik arama için telefon izni gerekir.',
        buttonPositive: 'İzin ver',
        buttonNegative: 'Hayır',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

export async function dialNumber(phone: string): Promise<boolean> {
  const cleaned = cleanPhone(phone);
  if (!cleaned) return false;

  if (Platform.OS === 'android') {
    const canCall = await requestCallPermission();
    try {
      if (canCall) {
        await IntentLauncher.startActivityAsync('android.intent.action.CALL', {
          data: `tel:${cleaned}`,
        });
        return true;
      }
      await IntentLauncher.startActivityAsync('android.intent.action.DIAL', {
        data: `tel:${cleaned}`,
      });
      return true;
    } catch (error) {
      console.warn('[SosService] Intent dial failed', error);
    }
  }

  try {
    const url = Platform.OS === 'ios' ? `telprompt:${cleaned}` : `tel:${cleaned}`;
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

async function openSmsComposer(phones: string[], message: string): Promise<boolean> {
  if (phones.length === 0) return false;

  if (Platform.OS === 'android') {
    try {
      // Tek alıcı + body — en güvenilir Intent
      await IntentLauncher.startActivityAsync('android.intent.action.SENDTO', {
        data: `smsto:${phones[0]}`,
        extra: {
          sms_body: message,
        },
      });
      return true;
    } catch (error) {
      console.warn('[SosService] SENDTO failed', error);
    }
  }

  try {
    if (await SMS.isAvailableAsync()) {
      const result = await SMS.sendSMSAsync(phones, message);
      return result.result !== 'cancelled';
    }
  } catch (error) {
    console.warn('[SosService] expo-sms failed', error);
  }

  try {
    const body = encodeURIComponent(message);
    const sep = Platform.OS === 'ios' ? '&' : '?';
    await Linking.openURL(`sms:${phones[0]}${sep}body=${body}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * SOS akışı (hızlı ve güvenilir):
 * 1) Uygulamayı öne getir
 * 2) HEMEN ara (konum bekleme)
 * 3) Konumu kısa timeout ile al
 * 4) SMS şablonunu aç
 */
export async function triggerSos(
  contacts: EmergencyContact[],
  baseMessage: string,
  reasonPrefix = 'ACİL DURUM'
): Promise<SosResult> {
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
    () => undefined
  );

  const phones = collectPhones(contacts);
  const primary = pickPrimaryPhone(contacts);

  if (phones.length === 0 && !primary) {
    return {
      smsOpened: false,
      calledPhone: null,
      locationAttached: false,
      message: '',
      error:
        'Acil kişi telefon numarası yok. Ayarlar → Acil Kişi alanına numara girip Kaydet.',
    };
  }

  await bringAppToForeground();
  await sleep(400);

  let calledPhone: string | null = null;
  let smsOpened = false;
  let error: string | undefined;

  // 1) ÖNCE ARA — konum beklenmez
  if (primary) {
    try {
      const ok = await dialNumber(primary);
      calledPhone = ok ? primary : null;
      if (!ok) error = 'Arama başlatılamadı.';
    } catch {
      error = 'Arama başlatılamadı.';
    }
  }

  // 2) Konum en fazla 3 sn — asla SOS'u kilitlemesin
  const location = await withTimeout(
    getEmergencyLocationText(),
    3000,
    {
      text: 'Konum zaman aşımı. Lütfen hemen arayın.',
      attached: false,
    }
  );

  const message = [
    `${reasonPrefix} — Güvenli Yaşlı Asistanı`,
    baseMessage,
    '',
    location.text,
    '',
    `Zaman: ${new Date().toLocaleString('tr-TR')}`,
  ].join('\n');

  // 3) SMS (kullanıcı Gönder'e basmalı — Android sessiz SMS göndermez)
  await sleep(1200);
  try {
    await bringAppToForeground();
    await sleep(300);
    smsOpened = await openSmsComposer(
      phones.length ? phones : primary ? [primary] : [],
      message
    );
    if (!smsOpened) {
      error = [error, 'SMS ekranı açılamadı.'].filter(Boolean).join(' ');
    }
  } catch {
    error = [error, 'SMS ekranı açılamadı.'].filter(Boolean).join(' ');
  }

  return {
    smsOpened,
    calledPhone,
    locationAttached: location.attached,
    message,
    error,
  };
}

export const triggerSosAlert = triggerSos;

export const SosService = {
  triggerSos,
  dialNumber,
  collectPhones,
  pickPrimaryPhone,
  bringAppToForeground,
};
