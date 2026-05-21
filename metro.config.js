// FitKit Mobile — Metro config for Expo + NativeWind.
//
// Sentry: per docs.sentry.io/platforms/react-native/manual-setup/expo/,
// the base Expo config is replaced with `getSentryExpoConfig` so source
// maps + debug ids are emitted into the bundle for upload during EAS Build.

const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const { withNativeWind } = require('nativewind/metro');

const config = getSentryExpoConfig(__dirname);

module.exports = withNativeWind(config, { input: './global.css' });
