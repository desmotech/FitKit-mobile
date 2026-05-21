module.exports = function (api) {
  api.cache(true);
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      // Strip console.* in production builds — keep `error` and `warn` so
      // crash logs + Sentry breadcrumbs stay useful. Dev builds keep
      // everything for the noise we want when iterating.
      ...(isProduction
        ? [['transform-remove-console', { exclude: ['error', 'warn'] }]]
        : []),
      // Reanimated v4 (Expo SDK 54+) moved the worklets engine into a
      // standalone package. The plugin path changed from
      // `react-native-reanimated/plugin` → `react-native-worklets/plugin`
      // and it MUST still be listed last.
      'react-native-worklets/plugin',
    ],
  };
};
