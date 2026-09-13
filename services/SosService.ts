import * as Haptics from 'expo-haptics';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Linking from 'expo-linking';
import * as Location from 'expo-location';
import * as SMS from 'expo-sms';
import * as Speech from 'expo-speech';
import {
  AppState,
  PermissionsAndroid,
  Platform,
} from 'react-native';

import { getEmergencyLocationText } from '@/services/LocationService';
import type { EmergencyContact, SosResult } from '@/types';

export type SosCheckItem = {
  label: string;
  ok: boolean;
  detail?: string;
};

export type SosReadiness = {
  ok: boolean;
  checks: SosCheckItem[];
};

function cleanPhone(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

function collectPhones(contacts: EmergencyContact[]): string[] {
  const seen = new Set<string>();
  const phones: string[] = [];
  for (const c of contacts) {
    const phone = cleanPhone(c.phone);
    if (phone.replace(/\D/g, '').length < 7) continue;
    if (seen.has(phone)) continue;
    seen.add(phone);
    phones.push(phone);
  }
  return phones;
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

function speakSmsSendHint(): void {
  try {
    Speech.stop();
    Speech.speak(
      "SMS ekranı açıldı. Lütfen gönder düğmesine basın.",
      { language: 'tr-TR', rate: 0.9, pitch: 1.0 }
    );
  } catch {
    // ignore
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

  const recipients = phones.join(';');

  if (Platform.OS === 'android') {
    try {
      await IntentLauncher.startActivityAsync('android.intent.action.SENDTO', {
        data: `smsto:${recipients}`,
        extra: {
          sms_body: message,
          'android.intent.extra.TEXT': message,
        },
      });
      speakSmsSendHint();
      return true;
    } catch (error) {
      console.warn('[SosService] SENDTO multi failed', error);
    }

    // Tek alıcıya düş
    try {
      await IntentLauncher.startActivityAsync('android.intent.action.SENDTO', {
        data: `smsto:${phones[0]}`,
        extra: { sms_body: message },
      });
      speakSmsSendHint();
      return true;
    } catch (error) {
      console.warn('[SosService] SENDTO single failed', error);
    }
  }

  try {
    if (await SMS.isAvailableAsync()) {
      const result = await SMS.sendSMSAsync(phones, message);
      if (result.result !== 'cancelled') {
        speakSmsSendHint();
        return true;
      }
      return false;
    }
  } catch (error) {
    console.warn('[SosService] expo-sms failed', error);
  }

  try {
    const body = encodeURIComponent(message);
    const sep = Platform.OS === 'ios' ? '&' : '?';
    const to = phones.join(',');
    await Linking.openURL(`sms:${to}${sep}body=${body}`);
    speakSmsSendHint();
    return true;
  } catch {
    return false;
  }
}

/** Arama/SMS açmadan SOS hazırlık kontrolü. */
export async function checkSosReadiness(
  contacts: EmergencyContact[]
): Promise<SosReadiness> {
  const phones = collectPhones(contacts);
  const checks: SosCheckItem[] = [];

  checks.push({
    label: 'Acil telefon',
    ok: phones.length > 0,
    detail:
      phones.length > 0
        ? `${phones.length} numara kayıtlı`
        : 'Ayarlardan en az 1 numara girin',
  });

  if (Platform.OS === 'android') {
    let callOk = false;
    try {
      callOk = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.CALL_PHONE
      );
    } catch {
      callOk = false;
    }
    checks.push({
      label: 'Arama izni',
      ok: callOk,
      detail: callOk ? 'Verildi' : 'Eksik — Kurulumdan verin',
    });
  }

  const loc = await Location.getForegroundPermissionsAsync();
  checks.push({
    label: 'Konum izni',
    ok: loc.status === Location.PermissionStatus.GRANTED,
    detail:
      loc.status === Location.PermissionStatus.GRANTED
        ? 'Verildi'
        : 'Eksik — SOS konum ekleyemez',
  });

  const smsAvailable = await SMS.isAvailableAsync().catch(() => true);
  checks.push({
    label: 'SMS hazır',
    ok: phones.length > 0 && smsAvailable !== false,
    detail:
      phones.length > 1
        ? 'Çoklu alıcı desteklenir (Gönder’e basılmalı)'
        : 'Android otomatik SMS atmaz; Gönder gerekir',
  });

  return {
    ok: checks.every((c) => c.ok),
    checks,
  };
}

/**
 * SOS akışı (hızlı ve güvenilir):
 * 1) Uygulamayı öne getir
 * 2) HEMEN ara (konum bekleme)
 * 3) Konumu kısa timeout ile al
 * 4) SMS şablonunu aç (tüm acil numaralar) + sesli "Gönder"e bas
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

  if (primary) {
    try {
      const ok = await dialNumber(primary);
      calledPhone = ok ? primary : null;
      if (!ok) error = 'Arama başlatılamadı.';
    } catch {
      error = 'Arama başlatılamadı.';
    }
  }

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

/** İlaç kaçırma: sadece SMS (arama yok). */
export async function openMissedMedicineSms(
  contacts: EmergencyContact[],
  medicineName: string,
  dosage: string
): Promise<boolean> {
  const phones = collectPhones(contacts);
  if (phones.length === 0) return false;

  const message = [
    'İLAÇ UYARISI — Güvenli Yaşlı Asistanı',
    `${medicineName} (${dosage}) saatinde alınmadı olabilir.`,
    'Lütfen kontrol edin.',
    `Zaman: ${new Date().toLocaleString('tr-TR')}`,
  ].join('\n');

  return openSmsComposer(phones, message);
}

export const triggerSosAlert = triggerSos;

export const SosService = {
  triggerSos,
  dialNumber,
  collectPhones,
  pickPrimaryPhone,
  bringAppToForeground,
  checkSosReadiness,
  openMissedMedicineSms,
};
