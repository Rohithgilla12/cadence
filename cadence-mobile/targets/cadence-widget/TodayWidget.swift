// "Today" widget. Quiet, headspace-adjacent — serif number, sans label,
// week dots. The medium variant adds the first few habit names. No icons,
// no shadows (DS §1, §6).
//
// Voice (PRD §20):
//   doneCount == 0       → "Today's open"
//   doneCount == total   → "Everything done"
//   otherwise            → "{done} of {total} done"

import SwiftUI
import WidgetKit

private struct WeekDots: View {
    let dots: [DayDot]

    var body: some View {
        HStack(spacing: 6) {
            ForEach(Array(dots.enumerated()), id: \.offset) { _, dot in
                dotView(for: dot.state)
            }
        }
    }

    @ViewBuilder
    private func dotView(for state: DayState) -> some View {
        switch state {
        case .pastDone:
            Circle().fill(WidgetTheme.mossLight)
                .frame(width: 8, height: 8)
        case .pastQuiet:
            Circle().stroke(WidgetTheme.hairline2, lineWidth: 0.5)
                .frame(width: 8, height: 8)
        case .today:
            Circle().fill(WidgetTheme.moss)
                .frame(width: 8, height: 8)
        case .future:
            Circle().fill(WidgetTheme.paper2)
                .frame(width: 8, height: 8)
        }
    }
}

private func summaryText(done: Int, total: Int) -> String {
    if total == 0 { return "No practices yet" }
    if done == 0 { return "Today's open" }
    if done == total { return "Everything done" }
    return "\(done) of \(total) done"
}

private struct TodaySmallView: View {
    let snapshot: WidgetSnapshot

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("TODAY")
                .font(.system(size: 10, weight: .medium))
                .tracking(0.8)
                .foregroundStyle(WidgetTheme.ink3)

            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text("\(snapshot.doneCount)")
                    .font(WidgetTheme.serif(size: 36))
                    .foregroundStyle(WidgetTheme.ink)
                Text("/ \(snapshot.totalCount)")
                    .font(.system(size: 13))
                    .foregroundStyle(WidgetTheme.ink3)
            }

            Text(summaryText(done: snapshot.doneCount, total: snapshot.totalCount))
                .font(.system(size: 12))
                .foregroundStyle(WidgetTheme.ink2)
                .lineLimit(2)

            Spacer(minLength: 0)

            WeekDots(dots: snapshot.weekDots)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .widgetURL(URL(string: "cadence://"))
    }
}

private struct TodayMediumView: View {
    let snapshot: WidgetSnapshot

    private var visibleHabits: [HabitSummary] {
        Array(snapshot.habits.prefix(4))
    }

    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            VStack(alignment: .leading, spacing: 8) {
                Text("TODAY")
                    .font(.system(size: 10, weight: .medium))
                    .tracking(0.8)
                    .foregroundStyle(WidgetTheme.ink3)

                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text("\(snapshot.doneCount)")
                        .font(WidgetTheme.serif(size: 44))
                        .foregroundStyle(WidgetTheme.ink)
                    Text("/ \(snapshot.totalCount)")
                        .font(.system(size: 14))
                        .foregroundStyle(WidgetTheme.ink3)
                }

                Text(summaryText(done: snapshot.doneCount, total: snapshot.totalCount))
                    .font(.system(size: 12))
                    .foregroundStyle(WidgetTheme.ink2)

                Spacer(minLength: 0)

                WeekDots(dots: snapshot.weekDots)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Divider()
                .background(WidgetTheme.hairline)

            VStack(alignment: .leading, spacing: 6) {
                ForEach(visibleHabits, id: \.id) { habit in
                    HStack(spacing: 8) {
                        Circle()
                            .fill(habit.doneToday ? WidgetTheme.moss : Color.clear)
                            .overlay(
                                Circle().stroke(
                                    habit.doneToday ? Color.clear : WidgetTheme.hairline2,
                                    lineWidth: 0.5
                                )
                            )
                            .frame(width: 8, height: 8)
                        Text(habit.name)
                            .font(.system(size: 12))
                            .foregroundStyle(habit.doneToday ? WidgetTheme.ink3 : WidgetTheme.ink)
                            .strikethrough(habit.doneToday, color: WidgetTheme.ink3)
                            .lineLimit(1)
                    }
                }
                if snapshot.habits.count > visibleHabits.count {
                    Text("+ \(snapshot.habits.count - visibleHabits.count) more")
                        .font(.system(size: 11))
                        .foregroundStyle(WidgetTheme.ink3)
                        .padding(.top, 2)
                }
                if snapshot.habits.isEmpty {
                    Text("Add a practice in Cadence to begin.")
                        .font(.system(size: 12))
                        .foregroundStyle(WidgetTheme.ink2)
                        .lineLimit(3)
                }
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, alignment: .topLeading)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .widgetURL(URL(string: "cadence://"))
    }
}

struct TodayWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    let entry: SnapshotEntry

    var body: some View {
        let content = Group {
            switch family {
            case .systemSmall:
                TodaySmallView(snapshot: entry.snapshot)
            default:
                TodayMediumView(snapshot: entry.snapshot)
            }
        }

        if #available(iOS 17.0, *) {
            content.containerBackground(WidgetTheme.paper, for: .widget)
        } else {
            content
                .padding(14)
                .background(WidgetTheme.paper)
        }
    }
}

struct TodayWidget: Widget {
    let kind: String = "CadenceTodayWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: CadenceTimelineProvider()) { entry in
            TodayWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Today")
        .description("Your habits and this week's rhythm.")
        .supportedFamilies([.systemSmall, .systemMedium])
        .contentMarginsDisabled()
    }
}
