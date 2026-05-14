// Shape of the JSON the RN side writes into the App Group's UserDefaults
// under `WidgetSnapshot.userDefaultsKey`. Mirrors
// `src/lib/widgets/types.ts` exactly — if either side changes, change both.
//
// Day order in `weekDots` is Mon..Sun (PRD §3 — Monday-first week).

import Foundation

enum DayState: String, Codable {
    case pastDone = "past-done"
    case pastQuiet = "past-quiet"
    case today
    case future
}

struct DayDot: Codable, Hashable {
    let weekday: String   // single-letter, e.g. "M"
    let state: DayState
}

struct HabitSummary: Codable, Hashable {
    let id: String
    let name: String
    let doneToday: Bool
}

enum InsightKind: String, Codable {
    case pattern
    case listening
}

struct InsightSnapshot: Codable, Hashable {
    let kind: InsightKind
    let renderedText: String
}

struct WidgetSnapshot: Codable, Hashable {
    static let userDefaultsKey = "cadence.snapshot.v1"
    static let appGroup = "group.fun.gilla.cadence"

    let updatedAt: Date
    let doneCount: Int
    let totalCount: Int
    let weekDots: [DayDot]
    let habits: [HabitSummary]
    let insight: InsightSnapshot

    static let placeholder = WidgetSnapshot(
        updatedAt: Date(),
        doneCount: 2,
        totalCount: 4,
        weekDots: [
            DayDot(weekday: "M", state: .pastDone),
            DayDot(weekday: "T", state: .pastDone),
            DayDot(weekday: "W", state: .pastQuiet),
            DayDot(weekday: "T", state: .pastDone),
            DayDot(weekday: "F", state: .today),
            DayDot(weekday: "S", state: .future),
            DayDot(weekday: "S", state: .future),
        ],
        habits: [
            HabitSummary(id: "1", name: "Morning walk", doneToday: true),
            HabitSummary(id: "2", name: "Read", doneToday: true),
            HabitSummary(id: "3", name: "Stretch", doneToday: false),
        ],
        insight: InsightSnapshot(
            kind: .listening,
            renderedText: "Cadence is listening."
        )
    )

    static func load() -> WidgetSnapshot {
        guard
            let defaults = UserDefaults(suiteName: appGroup),
            let raw = defaults.string(forKey: userDefaultsKey),
            let data = raw.data(using: .utf8)
        else {
            return .placeholder
        }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return (try? decoder.decode(WidgetSnapshot.self, from: data)) ?? .placeholder
    }
}
