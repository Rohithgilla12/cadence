// Lock-screen / Smart Stack accessory widgets.
//
//   accessoryInline      — single line text, always-on / standby line
//   accessoryCircular    — done/total in a moss progress ring
//   accessoryRectangular — fraction + the first not-done habit (or rest
//                          state copy) inside the wider Lock real estate

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

private struct RectangularAccessory: View {
    let snapshot: WidgetSnapshot

    private var nextOpenHabit: HabitSummary? {
        snapshot.habits.first(where: { !$0.doneToday })
    }

    private var primaryLine: String {
        if snapshot.totalCount == 0 { return "No practices yet" }
        if snapshot.doneCount == snapshot.totalCount { return "Everything done" }
        return "\(snapshot.doneCount) of \(snapshot.totalCount) today"
    }

    private var secondaryLine: String? {
        if let nextOpen = nextOpenHabit { return "Next · \(nextOpen.name)" }
        if snapshot.totalCount > 0 && snapshot.doneCount == snapshot.totalCount {
            return "Quiet from here."
        }
        return nil
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("CADENCE")
                .font(.system(size: 9, weight: .medium))
                .tracking(0.6)
            Text(primaryLine)
                .font(.system(size: 14, weight: .medium))
                .lineLimit(1)
            if let secondary = secondaryLine {
                Text(secondary)
                    .font(.system(size: 11))
                    .opacity(0.7)
                    .lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
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
        case .accessoryRectangular:
            RectangularAccessory(snapshot: entry.snapshot)
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
        .supportedFamilies([.accessoryCircular, .accessoryInline, .accessoryRectangular])
    }
}
