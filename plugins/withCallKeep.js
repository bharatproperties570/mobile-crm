const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withCallKeep(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults.manifest;

    // 1. Ensure uses-permission array exists
    if (!androidManifest['uses-permission']) {
      androidManifest['uses-permission'] = [];
    }

    const permissions = [
      'android.permission.BIND_TELECOM_CONNECTION_SERVICE',
      'android.permission.READ_PHONE_STATE',
      'android.permission.CALL_PHONE',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.MANAGE_OWN_CALLS',
    ];

    permissions.forEach((perm) => {
      const exists = androidManifest['uses-permission'].some(
        (p) => p.$['android:name'] === perm
      );
      if (!exists) {
        androidManifest['uses-permission'].push({
          $: { 'android:name': perm },
        });
      }
    });

    // 2. Ensure application element exists
    if (!androidManifest.application) {
      androidManifest.application = [{}];
    }
    const mainApplication = androidManifest.application[0];

    // Ensure service array exists under application
    if (!mainApplication.service) {
      mainApplication.service = [];
    }

    const serviceName = 'io.wazo.callkeep.VoiceConnectionService';
    const serviceExists = mainApplication.service.some(
      (s) => s.$['android:name'] === serviceName
    );

    if (!serviceExists) {
      mainApplication.service.push({
        $: {
          'android:name': serviceName,
          'android:label': 'Wazo',
          'android:permission': 'android.permission.BIND_TELECOM_CONNECTION_SERVICE',
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [
              {
                $: { 'android:name': 'android.telecom.ConnectionService' },
              },
            ],
          },
        ],
      });
    }

    return config;
  });
};
