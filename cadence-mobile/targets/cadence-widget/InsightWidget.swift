// Insight widget. Renders today's rotated insight or "Cadence is listening"
// — never fabricates (PRD §3, §8). Visual matches the in-app InsightCard:
// moss-tinted background, moss-light left bar, eyebrow label, serif italic
// for the listening state.

import SwiftUI
import WidgetKit

private let insightWidgetURL = URL(string: "cadence://reflect")

private struct InsightHeader: View {
    let snapshot: WidgetSnapshot
    var body: some View {
        Text(snapshot.insight.kind == .listening ? "STILL LISTENING" : "PATTERN NOTICED")
            .font(.system(size: 10, weight: .medium))
            .tracking(0.8)
            .foregroundStyle(WidgetTheme.moss)
    }
}

private struct InsightBody: View {
    let snapshot: WidgetSnapshot
    let serifSize: CGFloat
    let bodySize: CGFloat
    let lineLimit: Int

    var body: some View {
        if snapshot.insight.kind == .listening {
            Text(snapshot.insight.renderedText)
                .font(WidgetTheme.serif(size: serifSize, weight: .regular).italic())
                .foregroundStyle(WidgetTheme.ink2)
                .lineLimit(lineLimit)
        } else {
            Text(snapshot.insight.renderedText)
                .font(.system(size: bodySize))
                .foregroundStyle(WidgetTheme.ink)
                .lineLimit(lineLimit)
        }
    }
}

private struct InsightSmallView: View {
    let snapshot: WidgetSnapshot

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            InsightHeader(snapshot: snapshot)
            InsightBody(snapshot: snapshot, serifSize: 13, bodySize: 12, lineLimit: 5)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .widgetURL(insightWidgetURL)
    }
}

private struct InsightMediumView: View {
    let snapshot: WidgetSnapshot

    var body: some View {
        HStack(spacing: 0) {
            // Project-locked moss-light accent bar — matches the in-app
            // InsightCard. .impeccable.md documents this as the single
            // intentional border-left in the design system.
            Rectangle()
                .fill(WidgetTheme.mossLight)
                .frame(width: 2)
            VStack(alignment: .leading, spacing: 8) {
                InsightHeader(snapshot: snapshot)
                InsightBody(snapshot: snapshot, serifSize: 15, bodySize: 14, lineLimit: 5)
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, alignment: .topLeading)
            .padding(.leading, 12)
            .padding(.vertical, 12)
            .padding(.trailing, 12)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .widgetURL(insightWidgetURL)
    }
}

private struct InsightLargeView: View {
    let snapshot: WidgetSnapshot

    var body: some View {
        HStack(spacing: 0) {
            Rectangle()
                .fill(WidgetTheme.mossLight)
                .frame(width: 2)
            VStack(alignment: .leading, spacing: 14) {
                InsightHeader(snapshot: snapshot)
                InsightBody(snapshot: snapshot, serifSize: 22, bodySize: 20, lineLimit: 8)
                Spacer(minLength: 0)
                Text("Tap to open Reflect")
                    .font(.system(size: 10, weight: .medium))
                    .tracking(0.6)
                    .foregroundStyle(WidgetTheme.ink3)
            }
            .padding(.leading, 16)
            .padding(.vertical, 18)
            .padding(.trailing, 18)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .widgetURL(insightWidgetURL)
    }
}

struct InsightWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    let entry: SnapshotEntry

    var body: some View {
        let content = Group {
            switch family {
            case .systemSmall:
                InsightSmallView(snapshot: entry.snapshot)
            case .systemLarge:
                InsightLargeView(snapshot: entry.snapshot)
            default:
                InsightMediumView(snapshot: entry.snapshot)
            }
        }

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
            InsightWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Insight")
        .description("Today's rotated pattern, or quiet when nothing qualifies.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        .contentMarginsDisabled()
    }
}
