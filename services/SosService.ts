import * as Haptics from 'expo-haptics';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Linking from 'expo-linking';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import {
  AppState,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { sendSmsSilent, isSilentSmsAvailable } from 'auto-sms';

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

export async function requestSendSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.SEND_SMS,
      {
        title: 'SMS gönderme izni',
        message:
          'Acil durumda yakınıza otomatik SMS göndermek için izin gerekir. Düşen kişi Gönder’e basamaz.',
        buttonPositive: 'İzin ver',
        buttonNegative: 'Hayır',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

async function hasSendSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    return await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.SEND_SMS);
  } catch {
    return false;
  }
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

function speak(text: string): void {
  try {
    Speech.stop();
    Speech.speak(text, { language: 'tr-TR', rate: 0.92, pitch: 1.0 });
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

/** Sessiz SMS — kullanıcıya dokunma yok (Android SmsManager). */
async function sendSilentSmsToPhones(
  phones: string[],
  message: string
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  if (!isSilentSmsAvailable()) {
    return { sent: 0, failed: phones.length };
  }

  const allowed = await requestSendSmsPermission();
  if (!allowed) {
    return { sent: 0, failed: phones.length };
  }

  for (const phone of phones) {
    try {
      await sendSmsSilent(phone, message);
      sent += 1;
      await sleep(350);
    } catch (error) {
      console.warn('[SosService] silent SMS failed', phone, error);
      failed += 1;
    }
  }

  return { sent, failed };
}

/** Composer fallback — yalnızca sessiz SMS başarısızsa. */
async function openSmsComposer(phones: string[], message: string): Promise<boolean> {
  if (phones.length === 0) return false;
  const recipients = phones.join(';');

  try {
    await IntentLauncher.startActivityAsync('android.intent.action.SENDTO', {
      data: `smsto:${recipients}`,
      extra: { sms_body: message },
    });
    speak('SMS ekranı açıldı. Lütfen gönder düğmesine basın.');
    return true;
  } catch {
    try {
      const body = encodeURIComponent(message);
      await Linking.openURL(`sms:${phones[0]}?body=${body}`);
      speak('SMS ekranı açıldı. Lütfen gönder düğmesine basın.');
      return true;
    } catch {
      return false;
    }
  }
}

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
    const smsOk = await hasSendSmsPermission();
    checks.push({
      label: 'Otomatik SMS izni',
      ok: smsOk,
      detail: smsOk
        ? 'Sessiz SMS gönderilebilir'
        : 'Eksik — Kurulumdan SMS iznini verin',
    });

    let callOk = false;
    try {
      callOk = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.CALL_PHONE
      );
    } catch {
      callOk = false;
    }
    checks.push({
      label: 'Otomatik arama izni',
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

  return {
    ok: checks.every((c) => c.ok),
    checks,
  };
}

/**
 * Acil SOS:
 * 1) Konumu kısa timeout ile al
 * 2) Otomatik SMS (dokunmadan) — tüm acil numaralar
 * 3) Otomatik arama — birincil kişi
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
      smsSentCount: 0,
      smsFailedCount: 0,
      calledPhone: null,
      locationAttached: false,
      message: '',
      error:
        'Acil kişi telefon numarası yok. Ayarlar → Acil Kişi alanına numara girip Kaydet.',
    };
  }

  await bringAppToForeground();
  await sleep(300);

  speak('Acil durum. Yakınlarınıza mesaj gönderiliyor.');

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

  let error: string | undefined;
  let smsOpened = false;
  let smsSentCount = 0;
  let smsFailedCount = 0;

  // 1) OTOMATİK SMS — kullanıcı dokunmaz
  const silent = await sendSilentSmsToPhones(
    phones.length ? phones : primary ? [primary] : [],
    message
  );
  smsSentCount = silent.sent;
  smsFailedCount = silent.failed;

  if (smsSentCount > 0) {
    speak(
      smsSentCount === 1
        ? 'Acil mesaj gönderildi. Şimdi arama yapılıyor.'
        : `${smsSentCount} kişiye acil mesaj gönderildi. Şimdi arama yapılıyor.`
    );
  } else {
    // Son çare: composer (manuel Gönder)
    smsOpened = await openSmsComposer(
      phones.length ? phones : primary ? [primary] : [],
      message
    );
    if (!smsOpened) {
      error = 'Otomatik SMS gönderilemedi. SMS iznini kontrol edin.';
    } else {
      error =
        'Otomatik SMS izni yok veya başarısız — SMS ekranı açıldı, Gönder gerekir.';
    }
  }

  // 2) OTOMATİK ARAMA — SMS’ten sonra
  await sleep(smsSentCount > 0 ? 800 : 1500);
  let calledPhone: string | null = null;
  if (primary) {
    try {
      await bringAppToForeground();
      await sleep(200);
      const ok = await dialNumber(primary);
      calledPhone = ok ? primary : null;
      if (!ok) {
        error = [error, 'Arama başlatılamadı.'].filter(Boolean).join(' ');
      } else if (smsSentCount > 0) {
        speak('Acil kişi aranıyor.');
      }
    } catch {
      error = [error, 'Arama başlatılamadı.'].filter(Boolean).join(' ');
    }
  }

  return {
    smsOpened,
    smsSentCount,
    smsFailedCount,
    calledPhone,
    locationAttached: location.attached,
    message,
    error,
  };
}

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

  const silent = await sendSilentSmsToPhones(phones, message);
  if (silent.sent > 0) {
    speak('İlaç uyarısı yakınıza gönderildi.');
    return true;
  }
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
  requestSendSmsPermission,
};
