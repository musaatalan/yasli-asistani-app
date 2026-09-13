import { requireNativeModule } from 'expo';
import { Platform } from 'react-native';

export type GuardianConfig = {
  enabled: boolean;
  fallEnabled: boolean;
  voiceEnabled: boolean;
  sensitivity: string;
  countdownSeconds: number;
  phones: string;
  primaryPhone: string;
  message: string;
};

type GuardianNativeModuleType = {
  syncConfig(config: GuardianConfig): Promise<boolean>;
  start(): Promise<boolean>;
  stop(): Promise<boolean>;
  cancelAlert(): Promise<boolean>;
  isRunning(): boolean;
  openBatterySettings(): Promise<boolean>;
};

const native: GuardianNativeModuleType | null =
  Platform.OS === 'android'
    ? requireNativeModule<GuardianNativeModuleType>('GuardianNative')
    : null;

export async function syncGuardianConfig(config: GuardianConfig): Promise<boolean> {
  if (!native) return false;
  return native.syncConfig(config);
}

export async function startGuardian(): Promise<boolean> {
  if (!native) return false;
  return native.start();
}

export async function stopGuardian(): Promise<boolean> {
  if (!native) return false;
  return native.stop();
}

export async function cancelGuardianAlert(): Promise<boolean> {
  if (!native) return false;
  return native.cancelAlert();
}

export function isGuardianRunning(): boolean {
  if (!native) return false;
  try {
    return native.isRunning();
  } catch {
    return false;
  }
}

export async function openGuardianBatterySettings(): Promise<boolean> {
  if (!native) return false;
  return native.openBatterySettings();
}

export default {
  syncGuardianConfig,
  startGuardian,
  stopGuardian,
  cancelGuardianAlert,
  isGuardianRunning,
  openGuardianBatterySettings,
};
