import { Accelerometer } from 'expo-sensors';

export type FallSensitivity = 'low' | 'medium' | 'high';

type FallListener = () => void;
type Unsubscribe = () => void;

type Thresholds = {
  impactG: number;
  freefallG: number;
  freefallWindowMs: number;
  cooldownMs: number;
};

const PRESETS: Record<FallSensitivity, Thresholds> = {
  // total acceleration in g-units (1g ≈ gravity)
  high: { impactG: 2.0, freefallG: 0.45, freefallWindowMs: 1200, cooldownMs: 20000 },
  medium: { impactG: 2.5, freefallG: 0.4, freefallWindowMs: 1000, cooldownMs: 25000 },
  low: { impactG: 3.2, freefallG: 0.35, freefallWindowMs: 800, cooldownMs: 30000 },
};

let subscription: { remove: () => void } | null = null;
let lastTriggerAt = 0;
let impactAt: number | null = null;

/**
 * Düşme algılama:
 * 1) Ani darbe (total acceleration > impactG)
 * 2) Kısa süre içinde serbest düşüş / düşük ivme (freefallG)
 * Ardından listener tetiklenir → UI 10 sn geri sayım → SOS
 */
export const FallDetectionService = {
  start(onFallDetected: FallListener, sensitivity: FallSensitivity = 'medium'): Unsubscribe {
    this.stop();

    const thresholds = PRESETS[sensitivity];
    Accelerometer.setUpdateInterval(50);

    subscription = Accelerometer.addListener(({ x, y, z }) => {
      const g = Math.sqrt(x * x + y * y + z * z);
      const now = Date.now();

      if (g >= thresholds.impactG) {
        impactAt = now;
        return;
      }

      if (
        impactAt &&
        now - impactAt <= thresholds.freefallWindowMs &&
        g <= thresholds.freefallG
      ) {
        impactAt = null;
        if (now - lastTriggerAt < thresholds.cooldownMs) return;
        lastTriggerAt = now;
        onFallDetected();
        return;
      }

      if (impactAt && now - impactAt > thresholds.freefallWindowMs) {
        impactAt = null;
      }
    });

    return () => this.stop();
  },

  stop() {
    subscription?.remove();
    subscription = null;
    impactAt = null;
  },

  /** Test / demo: düşme olayını elle tetikle */
  simulateFall(onFallDetected: FallListener) {
    onFallDetected();
  },
};

/** Eski isim uyumluluğu */
export const SensorService = {
  startFallDetection: FallDetectionService.start.bind(FallDetectionService),
  stopFallDetection: FallDetectionService.stop.bind(FallDetectionService),
  startLoudNoiseDetection: (_cb: FallListener, _thresholdDb = 85): Unsubscribe => {
    console.info('[SensorService] Loud noise detection scaffold ready.');
    return () => undefined;
  },
};
