import { Accelerometer } from 'expo-sensors';

import { useFallAlertStore } from '@/store/fallAlertStore';

export type FallSensitivity = 'low' | 'medium' | 'high';

type FallListener = () => void;
type Unsubscribe = () => void;

type Phase = 'idle' | 'freefall' | 'impact' | 'stillness';

type Thresholds = {
  /** Darbe eşiği (kullanıcı: > 2.8G) */
  impactG: number;
  /** Serbest düşüş eşiği */
  freefallG: number;
  /** Serbest düşüşün en az bu süre devam etmesi */
  freefallMinMs: number;
  /** Serbest düşüşten darbeye kadar max pencere */
  freefallToImpactMs: number;
  /** Darbeden sonra hareketsizlik kontrol süresi */
  stillnessMs: number;
  /** Hareketsizlikte |g-1| üst sınırı */
  stillnessBandG: number;
  /** Hareketsizlik sırasında ani hareket eşiği */
  motionDeltaG: number;
  cooldownMs: number;
};

const PRESETS: Record<FallSensitivity, Thresholds> = {
  // impact sabit ~2.8G; diğerleri hassasiyete göre
  high: {
    impactG: 2.6,
    freefallG: 0.5,
    freefallMinMs: 80,
    freefallToImpactMs: 1200,
    stillnessMs: 2000,
    stillnessBandG: 0.45,
    motionDeltaG: 0.35,
    cooldownMs: 20000,
  },
  medium: {
    impactG: 2.8,
    freefallG: 0.45,
    freefallMinMs: 100,
    freefallToImpactMs: 1000,
    stillnessMs: 2000,
    stillnessBandG: 0.4,
    motionDeltaG: 0.4,
    cooldownMs: 25000,
  },
  low: {
    impactG: 3.0,
    freefallG: 0.4,
    freefallMinMs: 120,
    freefallToImpactMs: 900,
    stillnessMs: 2000,
    stillnessBandG: 0.35,
    motionDeltaG: 0.45,
    cooldownMs: 30000,
  },
};

let subscription: { remove: () => void } | null = null;
let lastTriggerAt = 0;
let alertPaused = false;

let phase: Phase = 'idle';
let freefallStartedAt: number | null = null;
let impactAt: number | null = null;
let lastG = 1;
let stillnessMotionHits = 0;

function resetPhase() {
  phase = 'idle';
  freefallStartedAt = null;
  impactAt = null;
  stillnessMotionHits = 0;
}

function magnitude(x: number, y: number, z: number) {
  return Math.sqrt(x * x + y * y + z * z);
}

/**
 * Düşme algılama state machine:
 * Serbest Düşüş → Darbe (>~2.8G) → 2 sn Hareketsizlik
 *
 * Darbeden sonra 2 sn içinde cihaz tekrar hareket ederse
 * (elden alma / koltuğa atma) sayaç BAŞLAMAZ.
 */
export const FallDetectionService = {
  pauseAlerts() {
    alertPaused = true;
    resetPhase();
  },

  resumeAlerts() {
    alertPaused = false;
    resetPhase();
  },

  isAlertPaused(): boolean {
    return alertPaused;
  },

  getPhase(): Phase {
    return phase;
  },

  openFallCountdown(
    seconds = 10,
    reason = 'Düşme algılandı (serbest düşüş + darbe + hareketsizlik)',
    nativeOwned = false
  ) {
    this.pauseAlerts();
    useFallAlertStore.getState().startCountdown(seconds, reason, { nativeOwned });
  },

  /**
   * Tek örnek işleme — hem ön planda hem foreground service içinde kullanılır.
   */
  processSample(
    x: number,
    y: number,
    z: number,
    onFallDetected: FallListener,
    sensitivity: FallSensitivity = 'medium'
  ) {
    if (alertPaused || useFallAlertStore.getState().active) {
      return;
    }

    const t = PRESETS[sensitivity];
    const g = magnitude(x, y, z);
    const now = Date.now();
    const delta = Math.abs(g - lastG);
    lastG = g;

    switch (phase) {
      case 'idle': {
        if (g <= t.freefallG) {
          phase = 'freefall';
          freefallStartedAt = now;
        }
        break;
      }

      case 'freefall': {
        if (freefallStartedAt == null) {
          resetPhase();
          break;
        }

        // Hâlâ düşüşte
        if (g <= t.freefallG) {
          break;
        }

        const freefallDuration = now - freefallStartedAt;

        // Darbe
        if (g >= t.impactG && freefallDuration >= t.freefallMinMs) {
          phase = 'stillness';
          impactAt = now;
          stillnessMotionHits = 0;
          break;
        }

        // Serbest düşüş penceresi doldu / geçersiz
        if (now - freefallStartedAt > t.freefallToImpactMs) {
          resetPhase();
        } else if (g > t.freefallG && g < t.impactG) {
          // Ara değer — düşüş bitti ama darbe yok; bekle veya sıfırla
          if (freefallDuration < t.freefallMinMs) {
            resetPhase();
          }
        }
        break;
      }

      case 'stillness': {
        if (impactAt == null) {
          resetPhase();
          break;
        }

        const elapsed = now - impactAt;

        // Elden alma / sallanma: yerçekimi bandı dışı veya ani delta
        const movedFromGravity = Math.abs(g - 1) > t.stillnessBandG;
        const suddenMove = delta > t.motionDeltaG;
        const secondaryImpact = g >= t.impactG * 0.85;

        if ((movedFromGravity && suddenMove) || secondaryImpact) {
          // Yanlış alarm — cihaz tekrar hareket etti
          resetPhase();
          break;
        }

        if (movedFromGravity || suddenMove) {
          stillnessMotionHits += 1;
          // Birkaç gürültülü örnek tolere et; sürekli hareket = iptal
          if (stillnessMotionHits >= 3) {
            resetPhase();
            break;
          }
        }

        if (elapsed >= t.stillnessMs) {
          if (now - lastTriggerAt < t.cooldownMs) {
            resetPhase();
            break;
          }
          lastTriggerAt = now;
          resetPhase();
          onFallDetected();
        }
        break;
      }

      default:
        resetPhase();
    }
  },

  start(onFallDetected: FallListener, sensitivity: FallSensitivity = 'medium'): Unsubscribe {
    this.stop();
    alertPaused = false;
    resetPhase();

    Accelerometer.setUpdateInterval(50);

    subscription = Accelerometer.addListener(({ x, y, z }) => {
      this.processSample(x, y, z, onFallDetected, sensitivity);
    });

    return () => this.stop();
  },

  stop() {
    subscription?.remove();
    subscription = null;
    resetPhase();
  },

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
