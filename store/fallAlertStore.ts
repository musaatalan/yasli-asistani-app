import { create } from 'zustand';

type FallAlertState = {
  active: boolean;
  secondsLeft: number;
  reason: string;
  /** Native guardian geri sayımı — SOS native tarafında atılır */
  nativeOwned: boolean;
  cancelledBanner: boolean;
  startCountdown: (
    seconds: number,
    reason?: string,
    options?: { nativeOwned?: boolean }
  ) => void;
  tick: () => void;
  cancel: () => void;
  clearCancelledBanner: () => void;
  consumeExpired: () => boolean;
};

export const useFallAlertStore = create<FallAlertState>((set, get) => ({
  active: false,
  secondsLeft: 0,
  reason: 'Düşme algılandı',
  nativeOwned: false,
  cancelledBanner: false,

  startCountdown: (seconds, reason = 'Düşme algılandı', options) => {
    if (get().active) return;
    set({
      active: true,
      secondsLeft: seconds,
      reason,
      nativeOwned: Boolean(options?.nativeOwned),
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
      nativeOwned: false,
      cancelledBanner: true,
    }),

  clearCancelledBanner: () => set({ cancelledBanner: false }),

  consumeExpired: () => {
    const { active, secondsLeft } = get();
    if (active && secondsLeft <= 0) {
      set({
        active: false,
        secondsLeft: 0,
        nativeOwned: false,
        cancelledBanner: false,
      });
      return true;
    }
    return false;
  },
}));
