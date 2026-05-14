// Lock-screen / Smart Stack accessory widgets. accessoryCircular shows
// the done/total fraction with a moss progress ring. accessoryInline is a
// single tiny string for the always-on / standby line.

import SwiftUI
import WidgetKit

private struct CircularProgress: View {
    let done: Int
    let total: Int

    private var progress: Double {
        guard total > 0 else { return 0 }
        return min(1.0, Double(done) / Double(total))
    }

    var body: some View {
        ZStack {
            Circle().stroke(WidgetTheme.hairline2, lineWidth: 2)
            Circle()
                .trim(from: 0, to: progress)
                .stroke(style: StrokeStyle(lineWidth: 2.5, lineCap: .round))
                .foregroundColor(WidgetTheme.moss)
                .rotationEffect(.degrees(-90))
            VStack(spacing: 0) {
                Text("\(done)")
                    .font(WidgetTheme.serif(size: 16))
                Text("of \(total)")
                    .font(.system(size: 8))
                    .opacity(0.7)
            }
        }
    }
}

struct LockWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    let entry: SnapshotEntry

    var body: some View {
        switch family {
        case .accessoryInline:
            Text("Cadence — \(entry.snapshot.doneCount)/\(entry.snapshot.totalCount) today")
        case .accessoryCircular:
            CircularProgress(done: entry.snapshot.doneCount, total: entry.snapshot.totalCount)
        default:
            EmptyView()
        }
    }
}

struct LockWidget: Widget {
    let kind: String = "CadenceLockWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: CadenceTimelineProvider()) { entry in
            LockWidgetEntryView(entry: entry).widgetURL(URL(string: "cadence://"))
        }
        .configurationDisplayName("Cadence")
        .description("A small reminder of today's count.")
        .supportedFamilies([.accessoryCircular, .accessoryInline])
    }
}
