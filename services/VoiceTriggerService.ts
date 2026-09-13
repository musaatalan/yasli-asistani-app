import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { Platform } from 'react-native';

import { FallDetectionService } from '@/services/FallDetectionService';
import { useFallAlertStore } from '@/store/fallAlertStore';
import { useAppStore } from '@/store/appStore';

export type VoiceListenMode = 'off' | 'emergency' | 'cancel';

export const VOICE_CANCEL_PHRASES = [
  'iptal',
  'iptal et',
  'iyiyim',
  'dur',
] as const;

export const VOICE_EMERGENCY_PHRASES = [
  'imdat',
  'yardim edin',
  'yardim et',
  'sos',
  'kurtarin',
] as const;

type PhraseListener = () => void;
type Unsubscribe = () => void;
type ListenerSub = { remove: () => void };

let subscriptions: ListenerSub[] = [];
let mode: VoiceListenMode = 'off';
let restartTimer: ReturnType<typeof setTimeout> | null = null;
let onCancel: PhraseListener | null = null;
let onEmergency: PhraseListener | null = null;
let lastEmergencyAt = 0;

const EMERGENCY_COOLDOWN_MS = 15000;

/**
 * Türkçe karakterleri sadeleştirip karşılaştırma için normalize eder.
 */
export function normalizeTurkish(text: string): string {
  return text
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesAny(transcript: string, phrases: readonly string[]): boolean {
  const normalized = normalizeTurkish(transcript);
  if (!normalized) return false;
  return phrases.some((phrase) => {
    const p = normalizeTurkish(phrase);
    return normalized === p || normalized.includes(p);
  });
}

export function transcriptMatchesCancel(transcript: string): boolean {
  return matchesAny(transcript, VOICE_CANCEL_PHRASES);
}

export function transcriptMatchesEmergency(transcript: string): boolean {
  return matchesAny(transcript, VOICE_EMERGENCY_PHRASES);
}

function clearRestartTimer() {
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }
}

function detachListeners() {
  subscriptions.forEach((sub) => sub.remove());
  subscriptions = [];
}

function abortNative() {
  try {
    ExpoSpeechRecognitionModule.abort();
  } catch {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      // ignore
    }
  }
}

function beginRecognitionSession() {
  if (mode === 'off') return;

  try {
    ExpoSpeechRecognitionModule.start({
      lang: 'tr-TR',
      interimResults: true,
      continuous: true,
      requiresOnDeviceRecognition: false,
      addsPunctuation: false,
      androidIntentOptions:
        Platform.OS === 'android'
          ? {
              EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 1500,
              EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 1000,
            }
          : undefined,
    });
  } catch (error) {
    console.warn('[VoiceTriggerService] start failed', error);
  }
}

function scheduleRestart() {
  if (mode === 'off') return;
  clearRestartTimer();
  restartTimer = setTimeout(() => {
    if (mode !== 'off') beginRecognitionSession();
  }, 400);
}

function defaultEmergencyHandler() {
  const seconds =
    useAppStore.getState().settings.sensors.fallCountdownSeconds ?? 10;
  FallDetectionService.openFallCountdown(
    seconds,
    'Sesli imdat komutu algılandı'
  );
}

function handleTranscript(transcript: string) {
  if (mode === 'off') return;

  if (mode === 'cancel') {
    if (!onCancel) return;
    if (transcriptMatchesCancel(transcript)) {
      const cb = onCancel;
      // Cancel modunda dinlemeyi kes; emergency'ye dönüş overlay cleanup'ta yapılır
      void VoiceTriggerService.stop();
      cb();
    }
    return;
  }

  if (mode === 'emergency') {
    if (useFallAlertStore.getState().active) return;
    if (!transcriptMatchesEmergency(transcript)) return;

    const now = Date.now();
    if (now - lastEmergencyAt < EMERGENCY_COOLDOWN_MS) return;
    lastEmergencyAt = now;

    const cb = onEmergency ?? defaultEmergencyHandler;
    // Overlay açılmadan önce emergency dinlemeyi bırak (cancel moda geçilecek)
    abortNative();
    clearRestartTimer();
    mode = 'off';
    cb();
  }
}

function attachCoreListeners() {
  detachListeners();

  subscriptions.push(
    ExpoSpeechRecognitionModule.addListener('result', (event) => {
      const texts = (event.results ?? [])
        .map((r) => r.transcript ?? '')
        .filter(Boolean);
      for (const text of texts) {
        handleTranscript(text);
      }
    })
  );

  subscriptions.push(
    ExpoSpeechRecognitionModule.addListener('end', () => {
      scheduleRestart();
    })
  );

  subscriptions.push(
    ExpoSpeechRecognitionModule.addListener('error', (event) => {
      console.warn('[VoiceTriggerService] error', event.error, event.message);
      if (mode !== 'off' && event.error !== 'aborted') {
        scheduleRestart();
      }
    })
  );
}

/**
 * Sesli tetikleyici:
 * - emergency: İMDAT / YARDIM / SOS / KURTARIN → openFallCountdown
 * - cancel: İPTAL / İYİYİM / DUR → overlay iptali
 */
export const VoiceTriggerService = {
  getMode(): VoiceListenMode {
    return mode;
  },

  isListening(): boolean {
    return mode !== 'off';
  },

  async requestPermission(): Promise<boolean> {
    try {
      const current = await ExpoSpeechRecognitionModule.getPermissionsAsync();
      if (current.granted) return true;
      const asked = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      return asked.granted;
    } catch {
      return false;
    }
  },

  /**
   * Normal durum: acil kelimeleri dinle.
   */
  async startEmergencyMode(
    onEmergencyPhrase?: PhraseListener
  ): Promise<Unsubscribe> {
    await this.stop();

    const granted = await this.requestPermission();
    if (!granted) {
      console.warn('[VoiceTriggerService] Mikrofon / konuşma izni yok');
      return () => undefined;
    }

    onEmergency = onEmergencyPhrase ?? defaultEmergencyHandler;
    onCancel = null;
    mode = 'emergency';
    attachCoreListeners();
    beginRecognitionSession();

    return () => {
      void this.stop();
    };
  },

  /**
   * Overlay açıkken: iptal kelimelerini dinle.
   */
  async startCancelMode(onCancelPhrase: PhraseListener): Promise<Unsubscribe> {
    await this.stop();

    const granted = await this.requestPermission();
    if (!granted) {
      console.warn('[VoiceTriggerService] Mikrofon / konuşma izni yok');
      return () => undefined;
    }

    onCancel = onCancelPhrase;
    onEmergency = null;
    mode = 'cancel';
    attachCoreListeners();
    beginRecognitionSession();

    return () => {
      void this.stop();
    };
  },

  /** @deprecated Prefer startCancelMode */
  async start(onCancelPhrase: PhraseListener): Promise<Unsubscribe> {
    return this.startCancelMode(onCancelPhrase);
  },

  /**
   * Overlay kapandıktan sonra acil dinlemeye geri dön.
   */
  async resumeEmergencyMode(
    onEmergencyPhrase?: PhraseListener
  ): Promise<Unsubscribe> {
    return this.startEmergencyMode(onEmergencyPhrase);
  },

  async stop(): Promise<void> {
    mode = 'off';
    onCancel = null;
    onEmergency = null;
    clearRestartTimer();
    detachListeners();
    abortNative();
  },
};
