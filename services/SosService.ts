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

/** Uygulama ön plana gelene kadar bekle (arka plan Intent engelini aşmak için). */
async function waitUntilActive(timeoutMs = 8000): Promise<boolean> {
  if (AppState.currentState === 'active') return true;

  try {
    await Linking.openURL('yasliasistani://');
  } catch {
    // ignore
  }

  return new Promise((resolve) => {
    if (AppState.currentState === 'active') {
      resolve(true);
      return;
    }

    const timer = setTimeout(() => {
      sub.remove();
      resolve(AppState.currentState === 'active');
    }, timeoutMs);

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        clearTimeout(timer);
        sub.remove();
        resolve(true);
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
        // Doğrudan ara (kullanıcı Onay vermeden hat açılır — izin varsa)
        await IntentLauncher.startActivityAsync('android.intent.action.CALL', {
          data: `tel:${cleaned}`,
        });
        return true;
      }
      // İzin yoksa numaralı arama ekranı
      await IntentLauncher.startActivityAsync('android.intent.action.DIAL', {
        data: `tel:${cleaned}`,
      });
      return true;
    } catch (error) {
      console.warn('[SosService] Intent dial failed, fallback Linking', error);
    }
  }

  const url = Platform.OS === 'ios' ? `telprompt:${cleaned}` : `tel:${cleaned}`;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

async function openSmsComposer(phones: string[], message: string): Promise<boolean> {
  if (phones.length === 0) return false;

  // 1) expo-sms (mümkünse)
  try {
    if (await SMS.isAvailableAsync()) {
      const result = await SMS.sendSMSAsync(phones, message);
      // cancelled değilse ekran açılmış demektir
      if (result.result !== 'cancelled') {
        return true;
      }
      // Kullanıcı iptal ettiyse yine de true saymayalım — fallback dene
    }
  } catch (error) {
    console.warn('[SosService] expo-sms failed', error);
  }

  // 2) Android Intent
  if (Platform.OS === 'android') {
    try {
      await IntentLauncher.startActivityAsync('android.intent.action.SENDTO', {
        data: `smsto:${phones.join(';')}`,
        extra: {
          sms_body: message,
          'android.intent.extra.TEXT': message,
        },
      });
      return true;
    } catch (error) {
      console.warn('[SosService] SENDTO failed', error);
    }
  }

  // 3) Deep link fallback
  try {
    const body = encodeURIComponent(message);
    const separator = Platform.OS === 'ios' ? '&' : '?';
    await Linking.openURL(`sms:${phones[0]}${separator}body=${body}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * SOS: Önce uygulama ön planda olsun → SMS şablonu açılsın → kısa bekleme → arama.
 * Not: iOS/Android güvenlik kuralları nedeniyle SMS çoğu cihazda kullanıcı onayı ister;
 * arama CALL_PHONE izniyle doğrudan başlatılabilir.
 */
export async function triggerSos(
  contacts: EmergencyContact[],
  baseMessage: string,
  reasonPrefix = 'ACİL DURUM'
): Promise<SosResult> {
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

  const phones = collectPhones(contacts);
  const primary = pickPrimaryPhone(contacts);

  const { text: locationText, attached } = await getEmergencyLocationText();
  const message = [
    `${reasonPrefix} — Güvenli Yaşlı Asistanı`,
    baseMessage,
    '',
    locationText,
    '',
    `Zaman: ${new Date().toLocaleString('tr-TR')}`,
  ].join('\n');

  if (phones.length === 0 && !primary) {
    return {
      smsOpened: false,
      calledPhone: null,
      locationAttached: attached,
      message,
      error: 'Acil kişi telefon numarası yok. Ayarlar → Acil Kişi alanına numara girin.',
    };
  }

  // Arka plandan Intent açmak Android'de engellenir — önce öne getir
  await waitUntilActive();
  await sleep(600);

  let smsOpened = false;
  let calledPhone: string | null = null;
  let error: string | undefined;

  // Önce SMS ekranı (konum linkli), sonra arama — birbirini ezmesin diye aralıklı
  try {
    smsOpened = await openSmsComposer(phones.length ? phones : primary ? [primary] : [], message);
  } catch (e) {
    error = 'SMS ekranı açılamadı.';
    console.warn(e);
  }

  // SMS uygulaması öne gelsin, sonra aramaya geç
  await sleep(2500);

  if (primary) {
    try {
      const ok = await dialNumber(primary);
      calledPhone = ok ? primary : null;
      if (!ok) {
        error = [error, 'Arama başlatılamadı.'].filter(Boolean).join(' ');
      }
    } catch (e) {
      error = [error, 'Arama başlatılamadı.'].filter(Boolean).join(' ');
      console.warn(e);
    }
  }

  return {
    smsOpened,
    calledPhone,
    locationAttached: attached,
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
  waitUntilActive,
};
