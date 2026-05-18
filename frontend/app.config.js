module.exports = {
  name: 'CarID',
  displayName: 'CarID',
  expo: {
    name: 'CarID',
    slug: 'frontend',
    version: '1.0.0',
    android: {
      package: 'com.pinstripezebra.carid',
    },
    ios: {
      bundleIdentifier: 'com.pinstripezebra.carid',
      buildNumber: '1',
    },
    extra: {
      eas: {
        projectId: 'd2732bdc-08fc-4024-a74c-aacf837feeb3',
      },
      revenueCatIosKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? '',
      revenueCatAndroidKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? '',
    },
    owner: 'pinstripezebra',
  },
};
