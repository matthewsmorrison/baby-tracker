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
    // Optional so snapshots written by older builds still decode; treat
    // nil as "tracked" (the pre-toggle behaviour).
    var trackedFeed: Bool?
    var trackedNappy: Bool?

    var showsFeeds: Bool { trackedFeed ?? true }
    var showsNappies: Bool { trackedNappy ?? true }

    static func load() -> TodaySnapshot? {
        guard let data = UserDefaults(suiteName: AppGroup.id)?.data(forKey: AppGroup.snapshotKey) else { return nil }
        return try? JSONDecoder().decode(TodaySnapshot.self, from: data)
    }

    func save() {
        guard let data = try? JSONEncoder().encode(self) else { return }
        UserDefaults(suiteName: AppGroup.id)?.set(data, forKey: AppGroup.snapshotKey)
    }
}

enum FeedSide: String, Codable {
    case left, right
    var label: String { self == .left ? "Left" : "Right" }
}

/// App-global breast-feed timer: survives closing the log sheet, drives the
/// floating pill, the Live Activity and the widget buttons. Lives in the
/// app group so the widget can start/pause it without launching the app.
struct FeedTimerState: Codable, Equatable {
    var side: FeedSide?
    var segmentStart: Date?
    var accLeft: TimeInterval = 0
    var accRight: TimeInterval = 0

    var isRunning: Bool { side != nil && segmentStart != nil }
    var isActive: Bool { isRunning || accLeft + accRight > 0 }

    func total(_ s: FeedSide, at now: Date = .now) -> TimeInterval {
        let base = s == .left ? accLeft : accRight
        if side == s, let start = segmentStart {
            return base + max(0, now.timeIntervalSince(start))
        }
        return base
    }

    var grandTotal: TimeInterval { total(.left) + total(.right) }

    /// Tap a side: start it (banking any other running side), or pause it.
    /// The single source of the toggle rules — the app and the widget intent
    /// must never disagree on what a tap means.
    mutating func toggle(_ tapped: FeedSide, at now: Date = .now) {
        if let running = side, let start = segmentStart {
            let elapsed = max(0, now.timeIntervalSince(start))
            if running == .left { accLeft += elapsed } else { accRight += elapsed }
            side = nil
            segmentStart = nil
            if running == tapped { return }
        }
        side = tapped
        segmentStart = now
    }

    static let key = "feed-timer"

    static func loadShared() -> FeedTimerState {
        guard let data = UserDefaults(suiteName: AppGroup.id)?.data(forKey: key),
              let saved = try? JSONDecoder().decode(FeedTimerState.self, from: data) else {
            return FeedTimerState()
        }
        return saved
    }

    func saveShared() {
        guard let data = try? JSONEncoder().encode(self) else { return }
        UserDefaults(suiteName: AppGroup.id)?.set(data, forKey: Self.key)
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
