// Expo dynamic config — reads app.json as base and applies per-variant overrides.
// Default (dev / `expo run:android` / debug) keeps the canonical package
// `com.facupich.cozyhabit`, so Google Sign-In OAuth (registered against that
// package) works out of the box during day-to-day development. Standalone
// builds (preview/production via eas.json) get a `.std` suffix so they can
// coexist on the same device as the dev install.
//
// Variants:
//   APP_VARIANT unset / development           -> com.facupich.cozyhabit       (canonical, dev)
//   APP_VARIANT=standalone                    -> com.facupich.cozyhabit.std   (preview/production)

module.exports = ({ config }) => {
  if (process.env.APP_VARIANT !== 'standalone') return config;

  return {
    ...config,
    name: `${config.name} Std`,
    android: {
      ...config.android,
      package: `${config.android.package}.std`,
    },
    ios: {
      ...config.ios,
      bundleIdentifier: `${config.ios.bundleIdentifier}.std`,
    },
  };
};
