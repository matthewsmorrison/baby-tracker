import Foundation
import Supabase
import ActivityKit
import WidgetKit
import UserNotifications
import UIKit

enum FeedSide: String, Codable {
    case left, right
    var label: String { self == .left ? "Left" : "Right" }
}

/// App-global breast-feed timer: survives closing the log sheet, drives the
/// floating pill and the Live Activity, persists across launches.
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
}

// One shared observable store: session, baby context, entries and day tags.
// All reads/writes go through the user's own RLS-scoped Supabase client —
// exactly the same authorization model as the web app.
@MainActor
final class Store: ObservableObject {
    static let shared = Store()

    let supabase = SupabaseClient(
        supabaseURL: URL(string: "https://qwxadzogxtrkpjufmogb.supabase.co")!,
        supabaseKey: "sb_publishable_9u5eC19VgR-l1ZllHTI3lA_5ItUrZtJ",
        options: SupabaseClientOptions(
            db: .init(encoder: BeanloDates.encoder, decoder: BeanloDates.decoder)
        )
    )

    @Published var session: Session?
    @Published var baby: Baby?
    @Published var role: String = "caregiver"
    @Published var carers: [Carer] = []
    @Published var entries: [Entry] = []
    @Published var dayTags: [DayTag] = []
    @Published var loading = false
    @Published var errorMessage: String?
    @Published private(set) var feedTimer = FeedTimerState() {
        didSet {
            if let data = try? JSONEncoder().encode(feedTimer) {
                UserDefaults.standard.set(data, forKey: "feed-timer")
            }
            syncLiveActivity()
        }
    }
    @Published var pushEnabled = UserDefaults.standard.bool(forKey: "push-enabled")

    var userId: UUID? { session?.user.id }
    var isOwner: Bool { role == "owner" }

    var trackedTypes: [EntryType] {
        let tracked = baby?.trackedTypes ?? ["nappy", "feed", "sleep", "weight"]
        let order: [EntryType] = [.nappy, .feed, .sleep, .weight, .pump, .carerSleep, .temperature, .milestone, .medication]
        return order.filter { tracked.contains($0.rawValue) }
    }

    private init() {
        if let data = UserDefaults.standard.data(forKey: "feed-timer"),
           let saved = try? JSONDecoder().decode(FeedTimerState.self, from: data) {
            feedTimer = saved
        }
    }

    // MARK: - Feed timer

    /// Tap a side: start it (banking any other running side), or pause it.
    func toggleFeedTimer(_ side: FeedSide) {
        var t = feedTimer
        let now = Date()
        if let running = t.side, let start = t.segmentStart {
            let elapsed = max(0, now.timeIntervalSince(start))
            if running == .left { t.accLeft += elapsed } else { t.accRight += elapsed }
            t.side = nil
            t.segmentStart = nil
            if running == side {
                feedTimer = t
                return
            }
        }
        t.side = side
        t.segmentStart = now
        feedTimer = t
    }

    /// Manual stepper adjustment (only while that side isn't running).
    func setFeedTimerMinutes(_ side: FeedSide, _ minutes: Int) {
        guard feedTimer.side != side else { return }
        var t = feedTimer
        let secs = TimeInterval(max(0, minutes) * 60)
        if side == .left { t.accLeft = secs } else { t.accRight = secs }
        feedTimer = t
    }

    func clearFeedTimer() {
        feedTimer = FeedTimerState()
    }

    /// Mirror the timer into a Live Activity (lock screen / Dynamic Island).
    private func syncLiveActivity() {
        let t = feedTimer
        let existing = Activity<FeedTimerAttributes>.activities.first
        guard t.isActive else {
            if let existing {
                Task { await existing.end(nil, dismissalPolicy: .immediate) }
            }
            return
        }
        // The timer can start before the baby context has loaded — fall back
        // to the widget snapshot's name and re-sync after refresh().
        let babyName = baby?.name ?? TodaySnapshot.load()?.babyName ?? "your baby"
        let status = { (s: String) in
            UserDefaults(suiteName: AppGroup.id)?.set(s, forKey: "live-activity-status")
        }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            status("disabled")
            return
        }
        let total = t.grandTotal
        let state = FeedTimerAttributes.ContentState(
            sideLabel: t.side?.label ?? "Paused",
            running: t.isRunning,
            startReference: Date().addingTimeInterval(-total),
            totalSeconds: Int(total)
        )
        if let existing {
            Task { await existing.update(ActivityContent(state: state, staleDate: nil)) }
        } else {
            do {
                _ = try Activity<FeedTimerAttributes>.request(
                    attributes: FeedTimerAttributes(babyName: babyName),
                    content: ActivityContent(state: state, staleDate: nil)
                )
                status("started")
            } catch {
                status("failed: \(error)")
            }
        }
    }

    // MARK: - Widgets

    /// Publish the numbers the lock-screen/home widgets show.
    private func writeWidgetSnapshot() {
        guard let baby else { return }
        let now = Date()
        let day = Clinical.dayOfLife(birthAt: baby.birthAt, at: now)
        let nappies = entries.filter {
            $0.type == .nappy && now.timeIntervalSince($0.occurredAt) <= 86_400 && $0.occurredAt <= now
        }
        TodaySnapshot(
            babyName: baby.name,
            dayOfLife: day,
            lastFeedAt: entries.first { $0.type == .feed }?.occurredAt,
            feedIntervalMin: baby.feedIntervalMin,
            nappyCount: nappies.count,
            nappyTarget: Clinical.expectedNappies(day: day).total,
            updatedAt: now
        ).save()
        WidgetCenter.shared.reloadAllTimelines()
    }

    // MARK: - Push notifications (APNs)

    /// Ask permission and register; the device token lands in AppDelegate
    /// which calls `uploadPushToken`.
    func enablePush() async -> Bool {
        let granted = (try? await UNUserNotificationCenter.current()
            .requestAuthorization(options: [.alert, .sound, .badge])) ?? false
        guard granted else {
            pushEnabled = false
            UserDefaults.standard.set(false, forKey: "push-enabled")
            return false
        }
        UIApplication.shared.registerForRemoteNotifications()
        pushEnabled = true
        UserDefaults.standard.set(true, forKey: "push-enabled")
        return true
    }

    func disablePush() async {
        if let token = UserDefaults.standard.string(forKey: "push-token") {
            try? await supabase.from("ios_push_tokens").delete().eq("token", value: token).execute()
        }
        UIApplication.shared.unregisterForRemoteNotifications()
        pushEnabled = false
        UserDefaults.standard.set(false, forKey: "push-enabled")
    }

    func uploadPushToken(_ hex: String) async {
        UserDefaults.standard.set(hex, forKey: "push-token")
        guard let userId else { return }
        struct TokenRow: Encodable {
            let user_id: UUID
            let token: String
        }
        _ = try? await supabase
            .from("ios_push_tokens")
            .upsert(TokenRow(user_id: userId, token: hex), onConflict: "token")
            .execute()
    }

    #if DEBUG
    /// Simulator test hook: `simctl launch … -DevSessionAT x -DevSessionRT y`
    /// injects a session without an email round trip. DEBUG builds only.
    func adoptDevSessionIfPresent() async {
        let defaults = UserDefaults.standard
        guard let at = defaults.string(forKey: "DevSessionAT"),
              let rt = defaults.string(forKey: "DevSessionRT") else { return }
        // Publish directly — listenToAuth() hasn't started yet at this point.
        session = try? await supabase.auth.setSession(accessToken: at, refreshToken: rt)
        if defaults.bool(forKey: "DevSmokeTest") {
            await runSmokeTest()
        }
    }

    /// Insert → update → delete round trip against the real backend, printing
    /// PASS/FAIL to the console (read via `simctl launch --console`).
    private func runSmokeTest() async {
        await refresh()
        guard let baby, let userId else { return print("SMOKE FAIL: no context") }
        do {
            var new = NewEntry(babyId: baby.id, type: .nappy, occurredAt: .now, createdBy: userId)
            new.wet = true
            new.dirty = false
            new.note = "smoke-test"
            try await save(new)
            guard var saved = entries.first(where: { $0.note == "smoke-test" }) else {
                return print("SMOKE FAIL: insert not reflected")
            }
            print("SMOKE PASS: insert \(saved.id)")
            saved.dirty = true
            try await update(saved)
            print("SMOKE PASS: update dirty=\(entries.first { $0.id == saved.id }?.dirty == true)")
            try await delete(saved)
            print("SMOKE PASS: delete, remaining=\(entries.filter { $0.note == "smoke-test" }.count)")
            var feed = NewEntry(babyId: baby.id, type: .feed, occurredAt: .now, createdBy: userId)
            feed.leftMin = 7
            feed.feedType = "breast"
            feed.note = "smoke-test"
            try await save(feed)
            if let f = entries.first(where: { $0.note == "smoke-test" }) {
                print("SMOKE PASS: feed insert left=\(f.leftMin ?? -1)")
                try await delete(f)
            }
            var med = NewEntry(babyId: baby.id, type: .medication, occurredAt: .now, createdBy: userId)
            med.medName = "Smoke"
            med.medKind = "dose"
            med.medSubject = "baby"
            med.note = "smoke-test"
            try await save(med)
            if let m = entries.first(where: { $0.note == "smoke-test" }) {
                print("SMOKE PASS: med insert kind=\(m.medKind ?? "nil")")
                try await delete(m)
            }
            print("SMOKE DONE")
            // Leave the verdict in the DB so the harness can read it.
            var verdict = NewEntry(babyId: baby.id, type: .milestone, occurredAt: .now, createdBy: userId)
            verdict.note = "SMOKE-VERDICT: all-passed"
            try await save(verdict)
        } catch {
            print("SMOKE FAIL: \(error)")
            var verdict = NewEntry(babyId: baby.id, type: .milestone, occurredAt: .now, createdBy: userId)
            verdict.note = "SMOKE-VERDICT: FAIL \(String(describing: error).prefix(300))"
            try? await save(verdict)
        }
    }
    #endif

    /// Follow Supabase auth state for the app's lifetime (initial session,
    /// sign-in, sign-out, token refresh).
    func listenToAuth() async {
        for await state in supabase.auth.authStateChanges {
            if [.initialSession, .signedIn, .signedOut, .tokenRefreshed].contains(state.event) {
                session = state.session
                if state.session != nil, baby == nil {
                    await refresh()
                }
                if state.session == nil {
                    baby = nil
                    entries = []
                    dayTags = []
                }
            }
        }
    }

    // MARK: - Auth (magic link that deep-links into the app; same accounts
    // as the web — the emailed button opens beanlo:// on the phone)

    func sendMagicLink(email: String) async throws {
        try await supabase.auth.signInWithOTP(
            email: email,
            redirectTo: URL(string: "beanlo://auth-callback"),
            shouldCreateUser: false
        )
    }

    /// Google OAuth in an in-app browser sheet; the redirect lands back on
    /// beanlo:// and the SDK completes the session automatically.
    func signInWithGoogle() async throws {
        try await supabase.auth.signInWithOAuth(
            provider: .google,
            redirectTo: URL(string: "beanlo://auth-callback")
        )
    }

    func handleDeepLink(_ url: URL) async {
        #if DEBUG
        // Simulator-only test hook: beanlo://dev-session?at=…&rt=… injects a
        // session so UI can be exercised without an email round trip.
        // Compiled out of Release builds — TestFlight never contains this.
        if url.host() == "dev-session",
           let comps = URLComponents(url: url, resolvingAgainstBaseURL: false),
           let at = comps.queryItems?.first(where: { $0.name == "at" })?.value,
           let rt = comps.queryItems?.first(where: { $0.name == "rt" })?.value {
            _ = try? await supabase.auth.setSession(accessToken: at, refreshToken: rt)
            return
        }
        #endif
        do {
            try await supabase.auth.session(from: url)
            Haptics.success()
        } catch {
            errorMessage = "That sign-in link didn't work — it may have expired. Request a fresh one."
        }
    }

    func signOut() async {
        try? await supabase.auth.signOut()
    }

    // MARK: - Data

    /// Baby context + a rolling window of entries + day tags, in parallel.
    func refresh() async {
        guard session != nil else { return }
        loading = entries.isEmpty
        defer { loading = false }
        do {
            if baby == nil {
                let memberships: [Membership] = try await supabase
                    .from("baby_members")
                    .select("role, baby:babies(*)")
                    .order("created_at", ascending: true)
                    .execute().value
                baby = memberships.first?.baby
                role = memberships.first?.role ?? "caregiver"
            }
            guard let baby else { return }

            let since = Calendar.current.date(byAdding: .day, value: -60, to: .now)!
            async let entriesReq: [Entry] = supabase
                .from("entries")
                .select("id, baby_id, type, occurred_at, ended_at, wet, dirty, stool_colour, nappy_weight_g, feed_type, left_min, right_min, expressed_ml, formula_ml, volume_ml, weight_g, length_mm, head_circ_mm, temp_c, med_name, med_dose, med_kind, med_subject, milestone_label, note, source")
                .eq("baby_id", value: baby.id)
                .gte("occurred_at", value: since.ISO8601Format())
                .order("occurred_at", ascending: false)
                .execute().value
            async let tagsReq: [DayTag] = supabase
                .from("baby_day_tags")
                .select()
                .eq("baby_id", value: baby.id)
                .execute().value
            entries = try await entriesReq
            dayTags = try await tagsReq
            errorMessage = nil
            writeWidgetSnapshot()
            // A timer started pre-load now gets its Live Activity (with the
            // real baby name).
            syncLiveActivity()
        } catch {
            errorMessage = friendly(error)
        }
    }

    /// Everyone with access to this baby, for Settings → Carers.
    func loadCarers() async {
        guard let baby else { return }
        struct MemberRow: Codable {
            let userId: UUID
            let role: String
            enum CodingKeys: String, CodingKey {
                case userId = "user_id"
                case role
            }
        }
        struct ProfileRow: Codable {
            let id: UUID
            let fullName: String?
            let email: String?
            enum CodingKeys: String, CodingKey {
                case id
                case fullName = "full_name"
                case email
            }
        }
        do {
            let members: [MemberRow] = try await supabase
                .from("baby_members")
                .select("user_id, role")
                .eq("baby_id", value: baby.id)
                .execute().value
            let profiles: [ProfileRow] = try await supabase
                .from("profiles")
                .select("id, full_name, email")
                .in("id", values: members.map(\.userId))
                .execute().value
            let byId = Dictionary(uniqueKeysWithValues: profiles.map { ($0.id, $0) })
            carers = members.map {
                Carer(id: $0.userId, role: $0.role, name: byId[$0.userId]?.fullName, email: byId[$0.userId]?.email)
            }
        } catch {
            // Carer list is decorative; stay quiet on failure.
        }
    }

    /// Owner-only baby settings update (RLS enforces the role server-side).
    func updateBaby(_ changes: BabyUpdate) async throws {
        guard let baby else { return }
        let updated: Baby = try await supabase
            .from("babies")
            .update(changes)
            .eq("id", value: baby.id)
            .select()
            .single()
            .execute().value
        self.baby = updated
        writeWidgetSnapshot()
        Haptics.success()
    }

    func save(_ new: NewEntry) async throws {
        let inserted: Entry = try await supabase
            .from("entries")
            .insert(new)
            .select()
            .single()
            .execute().value
        entries.insert(inserted, at: entries.firstIndex { $0.occurredAt < inserted.occurredAt } ?? entries.count)
        writeWidgetSnapshot()
        Haptics.success()
    }

    func update(_ entry: Entry) async throws {
        let updated: Entry = try await supabase
            .from("entries")
            .update(entry)
            .eq("id", value: entry.id)
            .select()
            .single()
            .execute().value
        if let i = entries.firstIndex(where: { $0.id == entry.id }) {
            entries[i] = updated
        }
        entries.sort { $0.occurredAt > $1.occurredAt }
        writeWidgetSnapshot()
        Haptics.success()
    }

    func delete(_ entry: Entry) async throws {
        try await supabase.from("entries").delete().eq("id", value: entry.id).execute()
        entries.removeAll { $0.id == entry.id }
        writeWidgetSnapshot()
    }

    /// Toggle a whole-day tag ("no_poo" / "teething") for a local calendar day.
    func toggleDayTag(_ tag: String, day: String) async {
        guard let baby, let userId else { return }
        do {
            if let existing = dayTags.first(where: { $0.day == day && $0.tag == tag }) {
                dayTags.removeAll { $0.id == existing.id }
                try await supabase.from("baby_day_tags").delete().eq("id", value: existing.id).execute()
            } else {
                let inserted: DayTag = try await supabase
                    .from("baby_day_tags")
                    .insert(NewDayTag(babyId: baby.id, day: day, tag: tag, createdBy: userId))
                    .select()
                    .single()
                    .execute().value
                dayTags.append(inserted)
            }
            Haptics.tap()
        } catch {
            errorMessage = friendly(error)
            await refresh()
        }
    }

    private func friendly(_ error: Error) -> String {
        let text = error.localizedDescription
        if text.localizedCaseInsensitiveContains("network") || text.localizedCaseInsensitiveContains("internet") {
            return "No connection — your entries are safe, try again when you're back online."
        }
        return text
    }
}
