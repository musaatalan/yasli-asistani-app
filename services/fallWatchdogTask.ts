/**
 * expo-task-manager iskeleti — arka plan düşme izleme watchdog.
 * Asıl sürekli sensör okuma BackgroundFallService (Android FGS) üzerindedir.
 */
import * as TaskManager from 'expo-task-manager';

import { BackgroundFallService } from '@/services/BackgroundFallService';
import { useAppStore } from '@/store/appStore';

export const FALL_WATCHDOG_TASK = 'YASLI_FALL_WATCHDOG';

TaskManager.defineTask(FALL_WATCHDOG_TASK, async () => {
  try {
    const enabled = useAppStore.getState().settings.sensors.fallDetectionEnabled;
    if (!enabled) {
      return;
    }
    if (!BackgroundFallService.isRunning()) {
      await BackgroundFallService.start();
    }
  } catch (error) {
    console.warn('[FallWatchdog]', error);
  }
});
