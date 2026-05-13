// Tiny Expo native module: writes a JSON snapshot to an App Group's
// UserDefaults suite and asks WidgetKit to reload all timelines.
//
// Both the main app target and the widget extension target must include
// the same `com.apple.security.application-groups` entitlement and the
// same suite name (see `app.config.ts` and
// `targets/cadence-widget/expo-target.config.json`).

import ExpoModulesCore
import WidgetKit

public class WidgetBridgeModule: Module {
    public func definition() -> ModuleDefinition {
        Name("WidgetBridge")

        Function("setSnapshot") { (appGroup: String, key: String, json: String) -> Bool in
            guard let defaults = UserDefaults(suiteName: appGroup) else {
                return false
            }
            defaults.set(json, forKey: key)
            if #available(iOS 14.0, *) {
                WidgetCenter.shared.reloadAllTimelines()
            }
            return true
        }

        Function("clearSnapshot") { (appGroup: String, key: String) -> Bool in
            guard let defaults = UserDefaults(suiteName: appGroup) else {
                return false
            }
            defaults.removeObject(forKey: key)
            if #available(iOS 14.0, *) {
                WidgetCenter.shared.reloadAllTimelines()
            }
            return true
        }

        Function("reloadAllTimelines") { () -> Void in
            if #available(iOS 14.0, *) {
                WidgetCenter.shared.reloadAllTimelines()
            }
        }
    }
}
