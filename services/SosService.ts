import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import * as SMS from 'expo-sms';
import { Platform } from 'react-native';

import { getEmergencyLocationText } from '@/services/LocationService';
import type { EmergencyContact, SosResult } from '@/types';

export async function dialNumber(phone: string): Promise<boolean> {
  const cleaned = phone.replace(/\s/g, '');
  if (!cleaned) return false;

  const url = Platform.select({
    ios: `telprompt:${cleaned}`,
    default: `tel:${cleaned}`,
  })!;

  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) {
    await Linking.openURL(`tel:${cleaned}`);
    return true;
  }

  await Linking.openURL(url);
  return true;
}

function collectPhones(contacts: EmergencyContact[]): string[] {
  return contacts
    .map((c) => c.phone.replace(/\s/g, ''))
    .filter((phone) => phone.length >= 7);
}

function pickPrimaryPhone(contacts: EmergencyContact[]): string | null {
  const primary = contacts.find((c) => c.isPrimary && c.phone.trim());
  if (primary) return primary.phone.replace(/\s/g, '');
  const any = contacts.find((c) => c.phone.trim());
  return any ? any.phone.replace(/\s/g, '') : null;
}

/**
 * SOS: GPS + Google Maps linkli SMS şablonu + birincil kişiye arama.
 */
export async function triggerSos(
  contacts: EmergencyContact[],
  baseMessage: string,
  reasonPrefix = 'ACİL DURUM'
): Promise<SosResult> {
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

  const { text: locationText, attached } = await getEmergencyLocationText();
  const message = [
    `${reasonPrefix} — Güvenli Yaşlı Asistanı`,
    baseMessage,
    '',
    locationText,
    '',
    `Zaman: ${new Date().toLocaleString('tr-TR')}`,
  ].join('\n');

  const phones = collectPhones(contacts);
  let smsOpened = false;

  if (phones.length > 0) {
    const available = await SMS.isAvailableAsync();
    if (available) {
      const result = await SMS.sendSMSAsync(phones, message);
      smsOpened = result.result === 'sent' || result.result === 'unknown';
    } else {
      // SMS API yoksa sms: deep link (tek alıcı)
      const body = encodeURIComponent(message);
      await Linking.openURL(`sms:${phones[0]}?body=${body}`);
      smsOpened = true;
    }
  }

  const primary = pickPrimaryPhone(contacts);
  let calledPhone: string | null = null;
  if (primary) {
    const ok = await dialNumber(primary);
    calledPhone = ok ? primary : null;
  }

  return {
    smsOpened,
    calledPhone,
    locationAttached: attached,
    message,
  };
}

/** Geriye dönük uyumluluk */
export const triggerSosAlert = triggerSos;

export const SosService = {
  triggerSos,
  dialNumber,
};
