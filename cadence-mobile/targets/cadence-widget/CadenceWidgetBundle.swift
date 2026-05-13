// Widget bundle — entry point for the extension. WidgetKit picks this up
// via the `@main` annotation on the `WidgetBundle`.

import SwiftUI
import WidgetKit

@main
struct CadenceWidgetBundle: WidgetBundle {
    var body: some Widget {
        TodayWidget()
        InsightWidget()
        LockWidget()
    }
}
