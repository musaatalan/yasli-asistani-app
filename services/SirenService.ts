import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Vibration } from 'react-native';

let sirenPlayer: AudioPlayer | null = null;
let isPlaying = false;
const listeners = new Set<(playing: boolean) => void>();

function notify() {
  listeners.forEach((listener) => listener(isPlaying));
}

async function configureAudioMax(options?: {
  allowRecording?: boolean;
}): Promise<void> {
  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    // Sesli iptal için kayıt + çalma birlikte olmalı
    interruptionMode: options?.allowRecording ? 'duckOthers' : 'doNotMix',
    allowsRecording: options?.allowRecording ?? false,
  });
}

/**
 * Döngüsel siren — expo-audio (New Architecture uyumlu).
 * Eski expo-av, RN New Arch ile UnsatisfiedLinkError veriyordu.
 */
export const SirenService = {
  subscribe(listener: (playing: boolean) => void): () => void {
    listeners.add(listener);
    listener(isPlaying);
    return () => {
      listeners.delete(listener);
    };
  },

  getIsPlaying(): boolean {
    return isPlaying;
  },

  async start(options?: { allowRecording?: boolean }): Promise<void> {
    if (isPlaying) return;

    await configureAudioMax(options);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Vibration.vibrate([0, 700, 300, 700], true);

    try {
      if (sirenPlayer) {
        sirenPlayer.release();
        sirenPlayer = null;
      }

      const player = createAudioPlayer(require('../assets/sounds/siren.wav'));
      player.loop = true;
      // Sesli komut duyulsun diye düşme modunda biraz kısık
      player.volume = options?.allowRecording ? 0.75 : 1.0;
      player.play();

      sirenPlayer = player;
      isPlaying = true;
      notify();
    } catch (error) {
      isPlaying = false;
      Vibration.cancel();
      notify();
      throw error;
    }
  },

  async stop(): Promise<void> {
    isPlaying = false;
    Vibration.cancel();

    if (sirenPlayer) {
      try {
        sirenPlayer.pause();
        sirenPlayer.release();
      } catch {
        // ignore
      }
      sirenPlayer = null;
    }

    notify();
  },

  async toggle(): Promise<boolean> {
    if (isPlaying) {
      await this.stop();
      return false;
    }
    await this.start();
    return true;
  },
};
