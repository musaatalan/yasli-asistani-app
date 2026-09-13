import { create } from 'zustand';

type FallAlertState = {
  active: boolean;
  secondsLeft: number;
  reason: string;
  /** İptal sonrası kısa 'İptal Edildi' gösterimi */
  cancelledBanner: boolean;
  startCountdown: (seconds: number, reason?: string) => void;
  tick: () => void;
  cancel: () => void;
  clearCancelledBanner: () => void;
  consumeExpired: () => boolean;
};

/**
 * Global düşme geri sayımı — overlay `_layout` üzerinden gösterilir.
 */
export const useFallAlertStore = create<FallAlertState>((set, get) => ({
  active: false,
  secondsLeft: 0,
  reason: 'Düşme algılandı',
  cancelledBanner: false,

  startCountdown: (seconds, reason = 'Düşme algılandı') => {
    if (get().active) return;
    set({
      active: true,
      secondsLeft: seconds,
      reason,
      cancelledBanner: false,
    });
  },

  tick: () => {
    const { active, secondsLeft } = get();
    if (!active) return;
    if (secondsLeft <= 1) {
      set({ secondsLeft: 0 });
      return;
    }
    set({ secondsLeft: secondsLeft - 1 });
  },

  cancel: () =>
    set({
      active: false,
      secondsLeft: 0,
      cancelledBanner: true,
    }),

  clearCancelledBanner: () => set({ cancelledBanner: false }),

  consumeExpired: () => {
    const { active, secondsLeft } = get();
    if (active && secondsLeft <= 0) {
      set({ active: false, secondsLeft: 0, cancelledBanner: false });
      return true;
    }
    return false;
  },
}));
