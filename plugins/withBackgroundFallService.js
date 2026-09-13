const { AndroidConfig } = require('@expo/config-plugins');

/**
 * Native guardian-native servisi için gerekli izinler.
 * (Eski RNBackgroundActionsTask kaldırıldı — FGS timeout çökmesine yol açıyordu.)
 */
function withBackgroundFallService(config) {
  return AndroidConfig.Permissions.withPermissions(config, [
    'android.permission.FOREGROUND_SERVICE',
    'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
    'android.permission.FOREGROUND_SERVICE_MICROPHONE',
    'android.permission.ACTIVITY_RECOGNITION',
    'android.permission.HIGH_SAMPLING_RATE_SENSORS',
    'android.permission.RECORD_AUDIO',
    'android.permission.WAKE_LOCK',
    'android.permission.POST_NOTIFICATIONS',
    'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
    'android.permission.RECEIVE_BOOT_COMPLETED',
    'android.permission.SEND_SMS',
    'android.permission.CALL_PHONE',
  ]);
}

module.exports = withBackgroundFallService;
