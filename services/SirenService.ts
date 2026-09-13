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

async function configureAudioMax(): Promise<void> {
  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: 'doNotMix',
    allowsRecording: false,
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

  async start(): Promise<void> {
    if (isPlaying) return;

    await configureAudioMax();
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Vibration.vibrate([0, 700, 300, 700], true);

    try {
      if (sirenPlayer) {
        sirenPlayer.release();
        sirenPlayer = null;
      }

      const player = createAudioPlayer(require('../assets/sounds/siren.wav'));
      player.loop = true;
      player.volume = 1.0;
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
