/**
 * Arka plan koruma watchdog — FGS düştüyse yeniden başlat.
 */
import * as TaskManager from 'expo-task-manager';

import { BackgroundFallService } from '@/services/BackgroundFallService';
import { useAppStore } from '@/store/appStore';

export const FALL_WATCHDOG_TASK = 'YASLI_FALL_WATCHDOG';

TaskManager.defineTask(FALL_WATCHDOG_TASK, async () => {
  try {
    if (!useAppStore.getState().onboardingCompleted) return;
    if (!BackgroundFallService.isRunning()) {
      await BackgroundFallService.start();
    }
  } catch (error) {
    console.warn('[FallWatchdog]', error);
  }
});
