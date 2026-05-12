// Patches the iOS Podfile so @react-native-firebase v24+ compiles under
// `use_frameworks!` static linkage. RNFB framework headers import React
// headers via `#import <React/...>`, which Clang treats as non-modular
// inside a framework module and errors out by default. We allow the
// non-modular include for RNFB* targets only — narrow and safe.
//
// Without this, `bunx expo run:ios` fails with:
//   include of non-modular header inside framework module
//   'RNFBApp.RCTConvert_FIRApp'
//
// Issue: react-native-firebase #7748 and related threads. Will likely
// be unnecessary once RNFB ships modular headers throughout.

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = 'CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES';

const PATCH = `
    # withFirebaseStaticFrameworks: allow non-modular React imports
    # inside RNFB* static frameworks (managed by Cadence config plugin).
    installer.pods_project.targets.each do |target|
      if target.name.start_with?('RNFB')
        target.build_configurations.each do |config|
          config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
        end
      end
    end
`;

const withFirebaseStaticFrameworks = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        'Podfile',
      );

      if (!fs.existsSync(podfilePath)) {
        return config;
      }

      let contents = fs.readFileSync(podfilePath, 'utf8');

      if (contents.includes(MARKER)) {
        return config;
      }

      const postInstallRegex = /(post_install do \|installer\|)/;
      if (!postInstallRegex.test(contents)) {
        throw new Error(
          'withFirebaseStaticFrameworks: could not find post_install block in Podfile',
        );
      }

      contents = contents.replace(postInstallRegex, `$1${PATCH}`);
      fs.writeFileSync(podfilePath, contents);
      return config;
    },
  ]);
};

module.exports = withFirebaseStaticFrameworks;
