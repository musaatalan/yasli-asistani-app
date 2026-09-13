import { requireNativeModule } from 'expo';
import { Platform } from 'react-native';

type SendResult = {
  ok: boolean;
  phone: string;
  parts: number;
};

type AutoSmsNative = {
  sendSms(phoneNumber: string, message: string): Promise<SendResult>;
  isAvailable(): boolean;
};

const native: AutoSmsNative | null =
  Platform.OS === 'android'
    ? requireNativeModule<AutoSmsNative>('AutoSms')
    : null;

export async function sendSmsSilent(
  phoneNumber: string,
  message: string
): Promise<SendResult> {
  if (!native) {
    throw new Error('Otomatik SMS yalnızca Android destekler');
  }
  return native.sendSms(phoneNumber, message);
}

export function isSilentSmsAvailable(): boolean {
  if (Platform.OS !== 'android' || !native) return false;
  try {
    return native.isAvailable();
  } catch {
    return false;
  }
}

export default {
  sendSmsSilent,
  isSilentSmsAvailable,
};
