const {
  withAndroidManifest,
  AndroidConfig,
} = require('@expo/config-plugins');

/**
 * react-native-background-actions için Android 14+ FGS izinleri ve service tipi.
 */
function withBackgroundFallService(config) {
  config = AndroidConfig.Permissions.withPermissions(config, [
    'android.permission.FOREGROUND_SERVICE',
    'android.permission.FOREGROUND_SERVICE_HEALTH',
    'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
    'android.permission.ACTIVITY_RECOGNITION',
    'android.permission.HIGH_SAMPLING_RATE_SENSORS',
    'android.permission.WAKE_LOCK',
    'android.permission.POST_NOTIFICATIONS',
    'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
  ]);

  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const app = manifest.application?.[0];
    if (!app) return config;

    if (!app.service) app.service = [];

    const serviceName = 'com.asterinet.react.bgactions.RNBackgroundActionsTask';
    let service = app.service.find(
      (s) => s.$?.['android:name'] === serviceName || s.$?.['android:name'] === '.RNBackgroundActionsTask'
    );

    if (!service) {
      service = {
        $: {
          'android:name': serviceName,
          'android:exported': 'false',
          'android:foregroundServiceType': 'specialUse',
        },
      };
      app.service.push(service);
    } else {
      service.$ = {
        ...service.$,
        'android:foregroundServiceType': 'specialUse',
        'android:exported': service.$['android:exported'] ?? 'false',
      };
    }

    // specialUse alt tipi açıklaması
    if (!app['property']) app['property'] = [];
    const propName = 'android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE';
    const exists = app['property'].some((p) => p.$?.['android:name'] === propName);
    if (!exists) {
      app['property'].push({
        $: {
          'android:name': propName,
          'android:value':
            'Elderly fall detection monitoring while screen is off',
        },
      });
    }

    return config;
  });
}

module.exports = withBackgroundFallService;
