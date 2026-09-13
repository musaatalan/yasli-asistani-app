import { create } from 'zustand';

type FallAlertState = {
  active: boolean;
  secondsLeft: number;
  reason: string;
  startCountdown: (seconds: number, reason?: string) => void;
  tick: () => void;
  cancel: () => void;
  consumeExpired: () => boolean;
};

/**
 * Global düşme geri sayımı — overlay `_layout` üzerinden gösterilir.
 */
export const useFallAlertStore = create<FallAlertState>((set, get) => ({
  active: false,
  secondsLeft: 0,
  reason: 'Düşme algılandı',

  startCountdown: (seconds, reason = 'Düşme algılandı') => {
    if (get().active) return;
    set({ active: true, secondsLeft: seconds, reason });
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

  cancel: () => set({ active: false, secondsLeft: 0 }),

  consumeExpired: () => {
    const { active, secondsLeft } = get();
    if (active && secondsLeft <= 0) {
      set({ active: false, secondsLeft: 0 });
      return true;
    }
    return false;
  },
}));
