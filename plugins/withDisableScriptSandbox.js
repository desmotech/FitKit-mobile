// Disable Xcode User Script Sandboxing — SDK 55 sets it YES, which breaks
// CocoaPods' Copy Pods Resources phase on local builds.
const { withXcodeProject } = require('expo/config-plugins');

const withDisableScriptSandbox = (config) =>
  withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const configurations = project.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(configurations)) {
      const buildSettings = configurations[key].buildSettings;
      if (buildSettings) {
        buildSettings.ENABLE_USER_SCRIPT_SANDBOXING = 'NO';
      }
    }
    return cfg;
  });

module.exports = withDisableScriptSandbox;
