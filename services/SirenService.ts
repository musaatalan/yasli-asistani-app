import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { Vibration } from 'react-native';

let sirenSound: Audio.Sound | null = null;
let isPlaying = false;
const listeners = new Set<(playing: boolean) => void>();

function notify() {
  listeners.forEach((listener) => listener(isPlaying));
}

async function configureAudioMax(): Promise<void> {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: true,
    interruptionModeIOS: InterruptionModeIOS.DoNotMix,
    interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
    shouldDuckAndroid: false,
    playThroughEarpieceAndroid: false,
  });
}

/**
 * Cihaz ses çıkışını uygulama tarafında maksimuma getirip döngüsel siren çalar.
 * Sistem ses çubuğunu zorunlu yükseltemeyiz; volume=1.0 + silent mode bypass kullanılır.
 */
export const SirenService = {
  subscribe(listener: (playing: boolean) => void): () => void {
    listeners.add(listener);
    listener(isPlaying);
    return () => listeners.delete(listener);
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
      if (sirenSound) {
        await sirenSound.unloadAsync();
        sirenSound = null;
      }

      const { sound } = await Audio.Sound.createAsync(
        require('../assets/sounds/siren.wav'),
        {
          isLooping: true,
          volume: 1.0,
          shouldPlay: true,
          isMuted: false,
          rate: 1.0,
          shouldCorrectPitch: true,
        }
      );

      await sound.setVolumeAsync(1.0);
      await sound.setIsLoopingAsync(true);
      await sound.playAsync();

      sirenSound = sound;
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

    if (sirenSound) {
      try {
        await sirenSound.stopAsync();
        await sirenSound.unloadAsync();
      } catch {
        // ignore unload errors
      }
      sirenSound = null;
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
