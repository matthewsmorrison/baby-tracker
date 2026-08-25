import Foundation
import SwiftUI
#if canImport(ActivityKit)
import ActivityKit
#endif

// Types shared between the app and the widget extension.

enum AppGroup {
    static let id = "group.io.beanlo"
    static let snapshotKey = "today-snapshot"
}

/// What the lock-screen/home widgets show — written by the app whenever its
/// data changes, read by the widget timeline.
struct TodaySnapshot: Codable {
    var babyName: String
    var dayOfLife: Int
    var lastFeedAt: Date?
    var feedIntervalMin: Int?
    var nappyCount: Int
    var nappyTarget: Int
    var updatedAt: Date

    static func load() -> TodaySnapshot? {
        guard let data = UserDefaults(suiteName: AppGroup.id)?.data(forKey: AppGroup.snapshotKey) else { return nil }
        return try? JSONDecoder().decode(TodaySnapshot.self, from: data)
    }

    func save() {
        guard let data = try? JSONEncoder().encode(self) else { return }
        UserDefaults(suiteName: AppGroup.id)?.set(data, forKey: AppGroup.snapshotKey)
    }
}

#if canImport(ActivityKit)
/// Live Activity for a running breast-feed timer (lock screen + Dynamic
/// Island). The timer ticks locally via `Text(timerInterval:)` — no pushes.
struct FeedTimerAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        /// "Left" / "Right" while running, "Paused" otherwise.
        var sideLabel: String
        var running: Bool
        /// `now - total elapsed` — feeds a self-ticking timer display.
        var startReference: Date
        /// Elapsed seconds banked so far (static display while paused).
        var totalSeconds: Int
    }
    var babyName: String
}
#endif
