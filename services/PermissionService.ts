import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Linking from 'expo-linking';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { PermissionsAndroid, Platform } from 'react-native';

export type PermissionKey =
  | 'notifications'
  | 'location'
  | 'backgroundLocation'
  | 'microphone'
  | 'callPhone'
  | 'sendSms'
  | 'activity'
  | 'photos'
  | 'battery';

export type PermissionItem = {
  key: PermissionKey;
  title: string;
  description: string;
  granted: boolean;
};

function packageName(): string {
  return (
    Constants.expoConfig?.android?.package ??
    'com.musaatalan.yasliasistani'
  );
}

async function checkNotifications(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

async function requestNotifications(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

async function checkLocation(): Promise<boolean> {
  const { status } = await Location.getForegroundPermissionsAsync();
  return status === Location.PermissionStatus.GRANTED;
}

async function requestLocation(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === Location.PermissionStatus.GRANTED;
}

async function checkBackgroundLocation(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const { status } = await Location.getBackgroundPermissionsAsync();
  return status === Location.PermissionStatus.GRANTED;
}

async function requestBackgroundLocation(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const fg = await requestLocation();
  if (!fg) return false;
  const { status } = await Location.requestBackgroundPermissionsAsync();
  return status === Location.PermissionStatus.GRANTED;
}

async function checkMicrophone(): Promise<boolean> {
  try {
    const current = await ExpoSpeechRecognitionModule.getPermissionsAsync();
    return Boolean(current.granted);
  } catch {
    return false;
  }
}

async function requestMicrophone(): Promise<boolean> {
  try {
    const asked = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    return Boolean(asked.granted);
  } catch {
    return false;
  }
}

async function checkCallPhone(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    return await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.CALL_PHONE
    );
  } catch {
    return false;
  }
}

async function requestCallPhone(): Promise<boolean> {
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

async function checkActivity(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    return await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION
    );
  } catch {
    return false;
  }
}

async function requestActivity(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
      {
        title: 'Hareket izni',
        message: 'Düşme algılama için fiziksel aktivite izni gerekir.',
        buttonPositive: 'İzin ver',
        buttonNegative: 'Hayır',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

async function checkSendSms(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    return await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.SEND_SMS
    );
  } catch {
    return false;
  }
}

async function requestSendSms(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.SEND_SMS,
      {
        title: 'SMS gönderme izni',
        message:
          'Acil durumda yakınıza otomatik (dokunmadan) SMS göndermek için gerekir.',
        buttonPositive: 'İzin ver',
        buttonNegative: 'Hayır',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

async function checkPhotos(): Promise<boolean> {
  const current = await ImagePicker.getMediaLibraryPermissionsAsync();
  return current.granted;
}

async function requestPhotos(): Promise<boolean> {
  const asked = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return asked.granted;
}

/** Pil: sistem diyaloğu / ayar sayfası; kesin “granted” bilinmeyebilir. */
async function requestBatteryOptimization(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    await IntentLauncher.startActivityAsync(
      'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
      { data: `package:${packageName()}` }
    );
    return true;
  } catch {
    try {
      await IntentLauncher.startActivityAsync(
        'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS'
      );
      return true;
    } catch {
      return false;
    }
  }
}

const META: Record<
  PermissionKey,
  { title: string; description: string }
> = {
  notifications: {
    title: 'Bildirimler',
    description: 'Düşme uyarısı ve ilaç hatırlatmaları',
  },
  location: {
    title: 'Konum',
    description: 'SOS mesajına harita linki eklemek için',
  },
  backgroundLocation: {
    title: 'Arka plan konum',
    description: 'Uygulama kapalıyken düşmede konum',
  },
  microphone: {
    title: 'Mikrofon / ses',
    description: 'İMDAT / İPTAL sesli komutları',
  },
  callPhone: {
    title: 'Telefon araması',
    description: 'Acil kişiyi otomatik aramak için',
  },
  sendSms: {
    title: 'Otomatik SMS',
    description: 'Düşmede yakına dokunmadan mesaj gönderir',
  },
  activity: {
    title: 'Hareket / aktivite',
    description: 'Düşme algılama arka plan servisi için',
  },
  photos: {
    title: 'Galeri',
    description: 'Hızlı rehbere fotoğraf eklemek için',
  },
  battery: {
    title: 'Pil kısıtlaması',
    description: 'Arka planda düşme algılama için “Kısıtlama yok”',
  },
};

export async function getPermissionStatuses(): Promise<PermissionItem[]> {
  const [
    notifications,
    location,
    backgroundLocation,
    microphone,
    callPhone,
    sendSms,
    activity,
    photos,
  ] = await Promise.all([
    checkNotifications(),
    checkLocation(),
    checkBackgroundLocation(),
    checkMicrophone(),
    checkCallPhone(),
    checkSendSms(),
    checkActivity(),
    checkPhotos(),
  ]);

  return (Object.keys(META) as PermissionKey[]).map((key) => {
    const granted =
      key === 'notifications'
        ? notifications
        : key === 'location'
          ? location
          : key === 'backgroundLocation'
            ? backgroundLocation
            : key === 'microphone'
              ? microphone
              : key === 'callPhone'
                ? callPhone
                : key === 'sendSms'
                  ? sendSms
                  : key === 'activity'
                    ? activity
                    : key === 'photos'
                      ? photos
                      : false;

    return {
      key,
      title: META[key].title,
      description: META[key].description,
      granted: key === 'battery' ? false : granted,
    };
  });
}

/** Sırayla tüm kritik izinleri ister (Android sistem diyalogları). */
export async function requestAllPermissions(): Promise<PermissionItem[]> {
  await requestNotifications();
  await requestLocation();
  await requestBackgroundLocation();
  await requestMicrophone();
  await requestCallPhone();
  await requestSendSms();
  await requestActivity();
  await requestPhotos();
  await requestBatteryOptimization();
  return getPermissionStatuses();
}

export async function openAppPermissionSettings(): Promise<void> {
  await Linking.openSettings();
}

export const PermissionService = {
  getPermissionStatuses,
  requestAllPermissions,
  openAppPermissionSettings,
  requestBatteryOptimization,
};
