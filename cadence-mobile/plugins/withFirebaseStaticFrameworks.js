// Patches the iOS Podfile so third-party RN modules that import React
// headers via `#import <React/...>` compile under `use_frameworks!`
// static linkage. Clang treats those imports as non-modular inside a
// framework module and errors out by default. We allow the non-modular
// include for a narrow allowlist of targets only.
//
// Without this, `bunx expo run:ios` fails with:
//   include of non-modular header inside framework module
//   'RNFBApp.RCTConvert_FIRApp'
//
// History: an earlier revision also injected `use_modular_headers!`
// after `use_frameworks!` in an attempt to make RNFB Analytics build.
// It didn't help — RNFBAnalyticsModule.m has a forest of
// RCT_EXPORT_METHOD macros whose parser fails before the modular
// include even matters — so the change was reverted and we removed
// the Analytics dep. Aptabase's bridge is much smaller (one
// RCT_EXTERN_MODULE line) so the CLANG flag is enough on its own.

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Targets that need the CLANG_ALLOW_NON_MODULAR_INCLUDES guard. The
// RNFB* prefix is shared by every Firebase target; the others are
// listed verbatim because their pod / target name is fixed.
const ALLOWLIST_PREFIXES = ['RNFB'];
const ALLOWLIST_NAMES = ['aptabase-react-native'];

const MARKER = 'CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES';

// The Ruby snippet keeps two checks: prefix match for the RNFB family
// (so a new Firebase subpackage gets the fix for free) and exact-name
// match for everything else.
const PATCH = `
    # withFirebaseStaticFrameworks: allow non-modular React imports
    # inside whitelisted static frameworks (managed by Cadence config
    # plugin — see plugins/withFirebaseStaticFrameworks.js for the
    # allowlist).
    cadence_allowlist_prefixes = ${JSON.stringify(ALLOWLIST_PREFIXES)}
    cadence_allowlist_names = ${JSON.stringify(ALLOWLIST_NAMES)}
    installer.pods_project.targets.each do |target|
      should_patch = cadence_allowlist_prefixes.any? { |p| target.name.start_with?(p) } ||
                     cadence_allowlist_names.include?(target.name)
      if should_patch
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

      // Idempotent — only patch when our marker isn't already present.
      // The marker is the build setting name itself; we keep the
      // earlier check semantics so re-running prebuild doesn't stack.
      // The patch is rewritten whenever the marker is missing so an
      // updated allowlist takes effect cleanly.
      if (contents.includes('cadence_allowlist_names')) {
        return config;
      }

      // Strip the older single-form block if it exists, so the
      // allowlist patch replaces it cleanly. The replacement is the
      // ALLOWLIST_NAMES + ALLOWLIST_PREFIXES patch above.
      contents = contents.replace(
        /\n\s*# withFirebaseStaticFrameworks: allow non-modular[\s\S]*?config\.build_settings\['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'\] = 'YES'\s*end\s*end\s*end\n/m,
        '\n',
      );

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
