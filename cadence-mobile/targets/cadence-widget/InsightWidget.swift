// Insight widget. Renders today's rotated insight or "Cadence is listening"
// — never fabricates (PRD §3, §8). Visual matches the in-app InsightCard:
// moss-tinted background, moss-light left bar, eyebrow label, serif italic
// for the listening state.

import SwiftUI
import WidgetKit

struct InsightWidgetEntryView: View {
    let entry: SnapshotEntry

    private var snapshot: WidgetSnapshot { entry.snapshot }

    private var label: String {
        snapshot.insight.kind == .listening ? "STILL LISTENING" : "PATTERN NOTICED"
    }

    var body: some View {
        let content = HStack(spacing: 0) {
            Rectangle()
                .fill(WidgetTheme.mossLight)
                .frame(width: 2)
            VStack(alignment: .leading, spacing: 8) {
                Text(label)
                    .font(.system(size: 10, weight: .medium))
                    .tracking(0.8)
                    .foregroundStyle(WidgetTheme.moss)

                if snapshot.insight.kind == .listening {
                    Text(snapshot.insight.renderedText)
                        .font(WidgetTheme.serif(size: 15, weight: .regular).italic())
                        .foregroundStyle(WidgetTheme.ink2)
                        .lineLimit(4)
                } else {
                    Text(snapshot.insight.renderedText)
                        .font(.system(size: 14))
                        .foregroundStyle(WidgetTheme.ink)
                        .lineLimit(5)
                }

                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, alignment: .topLeading)
            .padding(.leading, 12)
            .padding(.vertical, 12)
            .padding(.trailing, 12)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)

        if #available(iOS 17.0, *) {
            content.containerBackground(WidgetTheme.mossBg, for: .widget)
        } else {
            content.background(WidgetTheme.mossBg)
        }
    }
}

struct InsightWidget: Widget {
    let kind: String = "CadenceInsightWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: CadenceTimelineProvider()) { entry in
            InsightWidgetEntryView(entry: entry).widgetURL(URL(string: "cadence://"))
        }
        .configurationDisplayName("Insight")
        .description("Today's rotated pattern, or quiet when nothing qualifies.")
        .supportedFamilies([.systemMedium])
        .contentMarginsDisabled()
    }
}
