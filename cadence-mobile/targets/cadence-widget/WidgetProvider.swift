// Single TimelineProvider shared by Today / Insight / Lock widgets. The
// timeline is "static" — we never schedule speculative future snapshots
// because the data is event-driven (the app calls WidgetCenter.reload
// whenever the source data changes). We do schedule a hint refresh after
// midnight so the week strip rolls over even if the app isn't opened.

import WidgetKit

struct SnapshotEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot
}

struct CadenceTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> SnapshotEntry {
        SnapshotEntry(date: Date(), snapshot: .placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (SnapshotEntry) -> Void) {
        completion(SnapshotEntry(date: Date(), snapshot: WidgetSnapshot.load()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SnapshotEntry>) -> Void) {
        let now = Date()
        let entry = SnapshotEntry(date: now, snapshot: WidgetSnapshot.load())
        let nextMidnight = Calendar.current.nextDate(
            after: now,
            matching: DateComponents(hour: 0, minute: 5),
            matchingPolicy: .nextTime
        ) ?? now.addingTimeInterval(60 * 60 * 12)
        completion(Timeline(entries: [entry], policy: .after(nextMidnight)))
    }
}
