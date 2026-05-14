// Patches the iOS Podfile so @react-native-firebase v24+ compiles under
// `use_frameworks!` static linkage.
//
// Two patches are applied:
//
// 1. `use_modular_headers!` is added right after `use_frameworks!` in the
//    main target block. Under static frameworks the React-Core pod does
//    not expose its headers as a Swift/Clang module by default, so any
//    RNFB module that imports `<React/RCTBridgeModule.h>` (Analytics,
//    Messaging, Crashlytics, …) fails to build with errors like
//    "RCTBridgeModule must be imported from module 'RNFBApp.RNFBAppModule'
//    before it is required". Adding modular headers is the canonical
//    react-native-firebase fix for static frameworks. RNFB Auth and App
//    work without it because their config plugins handle this internally;
//    Analytics ships no config plugin and inherits no fix.
//
// 2. `CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES = YES` is set
//    on every RNFB* target in post_install. This was already needed before
//    modular headers existed in our Podfile and stays as a belt-and-braces
//    guard — some RNFB headers still reach for React-Core types via raw
//    `#import` even with the global modular_headers flag on.

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const POST_INSTALL_MARKER = 'CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES';
const MODULAR_HEADERS_MARKER = '# withFirebaseStaticFrameworks: modular_headers';

const POST_INSTALL_PATCH = `
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

const MODULAR_HEADERS_LINE = `\n  ${MODULAR_HEADERS_MARKER}\n  use_modular_headers!`;

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
      let modified = false;

      // Patch 1: inject `use_modular_headers!` right after the first
      // `use_frameworks!` line. Idempotent via the marker comment.
      if (!contents.includes(MODULAR_HEADERS_MARKER)) {
        const useFrameworksRegex = /(use_frameworks!.*$)/m;
        if (!useFrameworksRegex.test(contents)) {
          throw new Error(
            'withFirebaseStaticFrameworks: expected use_frameworks! line in Podfile (set via expo-build-properties useFrameworks: "static")',
          );
        }
        contents = contents.replace(useFrameworksRegex, `$1${MODULAR_HEADERS_LINE}`);
        modified = true;
      }

      // Patch 2: post_install hook for the CLANG non-modular-includes
      // guard on RNFB* targets.
      if (!contents.includes(POST_INSTALL_MARKER)) {
        const postInstallRegex = /(post_install do \|installer\|)/;
        if (!postInstallRegex.test(contents)) {
          throw new Error(
            'withFirebaseStaticFrameworks: could not find post_install block in Podfile',
          );
        }
        contents = contents.replace(postInstallRegex, `$1${POST_INSTALL_PATCH}`);
        modified = true;
      }

      if (modified) {
        fs.writeFileSync(podfilePath, contents);
      }
      return config;
    },
  ]);
};

module.exports = withFirebaseStaticFrameworks;
