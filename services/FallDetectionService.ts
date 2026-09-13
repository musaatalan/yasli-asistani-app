import { Accelerometer } from 'expo-sensors';

import { useFallAlertStore } from '@/store/fallAlertStore';

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
  high: { impactG: 2.0, freefallG: 0.45, freefallWindowMs: 1200, cooldownMs: 20000 },
  medium: { impactG: 2.5, freefallG: 0.4, freefallWindowMs: 1000, cooldownMs: 25000 },
  low: { impactG: 3.2, freefallG: 0.35, freefallWindowMs: 800, cooldownMs: 30000 },
};

let subscription: { remove: () => void } | null = null;
let lastTriggerAt = 0;
let impactAt: number | null = null;
/** Geri sayım / SOS sırasında yeni düşme tetiklemeyi engeller */
let alertPaused = false;

/**
 * Düşme algılama:
 * 1) Ani darbe (total acceleration > impactG)
 * 2) Kısa süre içinde serbest düşüş / düşük ivme (freefallG)
 * Ardından UI 10 sn geri sayım + sesli/dokunmatik iptal → aksi halde SOS
 */
export const FallDetectionService = {
  /** Overlay açıkken ivme dinleyicisini fiilen askıya al */
  pauseAlerts() {
    alertPaused = true;
  },

  /** Overlay kapandıktan sonra yeniden düşme algılamaya izin ver */
  resumeAlerts() {
    alertPaused = false;
  },

  isAlertPaused(): boolean {
    return alertPaused;
  },

  /**
   * Düşme olayını global geri sayım store'una iletir.
   * Sesli/dokunmatik iptal FallCountdownOverlay + VoiceTriggerService tarafında yönetilir.
   */
  openFallCountdown(seconds = 10, reason = 'Şiddetli ivme / olası düşme tespit edildi') {
    this.pauseAlerts();
    useFallAlertStore.getState().startCountdown(seconds, reason);
  },

  start(onFallDetected: FallListener, sensitivity: FallSensitivity = 'medium'): Unsubscribe {
    this.stop();
    alertPaused = false;

    const thresholds = PRESETS[sensitivity];
    Accelerometer.setUpdateInterval(50);

    subscription = Accelerometer.addListener(({ x, y, z }) => {
      if (alertPaused || useFallAlertStore.getState().active) {
        return;
      }

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
