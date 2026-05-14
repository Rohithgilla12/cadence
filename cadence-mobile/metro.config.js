const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Resolve the local Expo module's JS entry. Metro's autolinker handles the
// native side; this only teaches it where the JS lives.
config.resolver = config.resolver || {};
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  'widget-bridge': path.resolve(__dirname, 'modules/widget-bridge'),
};

module.exports = withNativeWind(config, { input: './global.css' });
