import Foundation
import AppIntents
import WidgetKit

// MARK: - One-tap nappy logging, shared by the app, widget buttons and Siri.
//
// The widget extension can't use the app's Supabase client (separate process,
// separate token storage), so the app mirrors its access token + baby context
// into the app group and this file talks to Supabase REST directly. It never
// refreshes tokens — that would rotate the refresh token out from under the
// app's session. If the token has expired (app not opened for >1h) or the
// network is down, the entry is queued in the app group and the app flushes
// it on next launch, so a 3am tap is never lost.

/// App-group credentials + context the quick logger needs. Written by the
/// app on every refresh and token refresh; cleared on sign-out.
struct QuickCreds: Codable {
    var accessToken: String
    var userId: UUID
    var babyId: UUID
    var trackedNappy: Bool

    static let key = "quick-creds"

    static func load() -> QuickCreds? {
        guard let data = UserDefaults(suiteName: AppGroup.id)?.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(QuickCreds.self, from: data)
    }

    func save() {
        guard let data = try? JSONEncoder().encode(self) else { return }
        UserDefaults(suiteName: AppGroup.id)?.set(data, forKey: Self.key)
    }

    static func clear() {
        UserDefaults(suiteName: AppGroup.id)?.removeObject(forKey: key)
        QuickQueue.clear()
    }
}

/// A nappy logged while Supabase was unreachable, waiting for the app.
struct QueuedNappy: Codable {
    var babyId: UUID
    var userId: UUID
    var dirty: Bool
    var occurredAt: Date
}

enum QuickQueue {
    static let key = "quick-queue"

    static func load() -> [QueuedNappy] {
        guard let data = UserDefaults(suiteName: AppGroup.id)?.data(forKey: key) else { return [] }
        return (try? JSONDecoder().decode([QueuedNappy].self, from: data)) ?? []
    }

    static func append(_ entry: QueuedNappy) {
        var all = load()
        all.append(entry)
        if let data = try? JSONEncoder().encode(all) {
            UserDefaults(suiteName: AppGroup.id)?.set(data, forKey: key)
        }
    }

    static func clear() {
        UserDefaults(suiteName: AppGroup.id)?.removeObject(forKey: key)
    }
}

enum QuickLogResult {
    case logged
    case queued
    case notSetUp
}

enum QuickLogger {
    private static let restURL = URL(string: "https://qwxadzogxtrkpjufmogb.supabase.co/rest/v1/entries")!
    private static let anonKey = "sb_publishable_9u5eC19VgR-l1ZllHTI3lA_5ItUrZtJ"

    /// Insert a nappy for "now". Falls back to the queue on any failure.
    static func logNappy(dirty: Bool) async -> QuickLogResult {
        guard let creds = QuickCreds.load() else { return .notSetUp }
        let now = Date()

        struct Row: Encodable {
            let baby_id: UUID
            let type = "nappy"
            let occurred_at: String
            let dirty: Bool
            let created_by: UUID
        }
        var request = URLRequest(url: restURL)
        request.httpMethod = "POST"
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(creds.accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        request.timeoutInterval = 10
        request.httpBody = try? JSONEncoder().encode(Row(
            baby_id: creds.babyId,
            occurred_at: now.ISO8601Format(),
            dirty: dirty,
            created_by: creds.userId
        ))

        var outcome = QuickLogResult.queued
        if let (_, response) = try? await URLSession.shared.data(for: request),
           let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) {
            outcome = .logged
        } else {
            QuickQueue.append(QueuedNappy(babyId: creds.babyId, userId: creds.userId, dirty: dirty, occurredAt: now))
        }

        // Reflect the tap on the widget immediately, logged or queued.
        if var snap = TodaySnapshot.load() {
            snap.nappyCount += 1
            snap.save()
        }
        WidgetCenter.shared.reloadAllTimelines()
        return outcome
    }
}

// MARK: - App Intent (widget buttons, Siri, Action Button, Shortcuts)

enum NappyKind: String, AppEnum {
    case wet
    case mixed

    static let typeDisplayRepresentation = TypeDisplayRepresentation(name: "Nappy kind")
    static let caseDisplayRepresentations: [NappyKind: DisplayRepresentation] = [
        .wet: "wet",
        .mixed: "mixed",
    ]
}

enum FeedSideChoice: String, AppEnum {
    case left
    case right

    static let typeDisplayRepresentation = TypeDisplayRepresentation(name: "Side")
    static let caseDisplayRepresentations: [FeedSideChoice: DisplayRepresentation] = [
        .left: "left",
        .right: "right",
    ]

    var side: FeedSide { self == .left ? .left : .right }
}

/// Start/pause the breast-feed timer from the widget or Siri. The timer
/// state lives in the app group; the app adopts it (and raises the Live
/// Activity) next time it comes to the foreground.
struct StartFeedTimerIntent: AppIntent {
    static let title: LocalizedStringResource = "Start feed timer"
    static let description = IntentDescription("Starts (or pauses) the breast-feed timer for one side.")
    static let openAppWhenRun = false

    @Parameter(title: "Side", default: .left)
    var side: FeedSideChoice

    init() {}
    init(side: FeedSideChoice) {
        self.side = side
    }

    func perform() async throws -> some IntentResult & ProvidesDialog {
        var timer = FeedTimerState.loadShared()
        timer.toggle(side.side)
        timer.saveShared()
        WidgetCenter.shared.reloadAllTimelines()
        if timer.isRunning {
            return .result(dialog: "Timing the \(side.rawValue) side.")
        }
        let mins = Int(timer.grandTotal / 60)
        return .result(dialog: "Feed timer paused at \(mins) minute\(mins == 1 ? "" : "s") — open beanlo to save the feed.")
    }
}

struct LogNappyIntent: AppIntent {
    static let title: LocalizedStringResource = "Log a nappy"
    static let description = IntentDescription("Logs a wet or mixed nappy for right now — no need to open the app.")
    static let openAppWhenRun = false

    @Parameter(title: "Kind", default: .wet)
    var kind: NappyKind

    init() {}
    init(kind: NappyKind) {
        self.kind = kind
    }

    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let creds = QuickCreds.load() else {
            return .result(dialog: "Open beanlo and sign in first.")
        }
        guard creds.trackedNappy else {
            return .result(dialog: "Nappy tracking is switched off in beanlo's settings.")
        }
        switch await QuickLogger.logNappy(dirty: kind == .mixed) {
        case .logged:
            return .result(dialog: "\(kind == .mixed ? "Mixed" : "Wet") nappy logged.")
        case .queued:
            return .result(dialog: "\(kind == .mixed ? "Mixed" : "Wet") nappy saved — it'll sync next time beanlo opens.")
        case .notSetUp:
            return .result(dialog: "Open beanlo and sign in first.")
        }
    }
}
