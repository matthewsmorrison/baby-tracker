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

    static let webBase = URL(string: "https://beanlo.com")!

    @Published var session: Session?
    @Published var baby: Baby?
    @Published var memberships: [Membership] = []
    @Published var role: String = "caregiver"
    @Published var carers: [Carer] = []
    @Published var myProfile: Profile?
    @Published var mySettings = UserSettings()
    @Published var entries: [Entry] = []
    @Published var activeCourses: [Entry] = []
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
    var canEdit: Bool { role == "owner" || role == "caregiver" }
    var aiEnabled: Bool { baby?.membershipTier == "advanced" }

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
        writeQuickCreds()
        WidgetCenter.shared.reloadAllTimelines()
    }

    /// Mirror the session + baby context into the app group so widget
    /// buttons and Siri can log a nappy without launching the app.
    private func writeQuickCreds() {
        guard let session, let baby else { return }
        QuickCreds(
            accessToken: session.accessToken,
            userId: session.user.id,
            babyId: baby.id,
            trackedNappy: trackedTypes.contains(.nappy)
        ).save()
    }

    /// Insert nappies the widget/Siri queued while the token was stale or
    /// the network was down.
    private func flushQuickQueue() async {
        let pending = QuickQueue.load()
        guard !pending.isEmpty else { return }
        for item in pending {
            var new = NewEntry(babyId: item.babyId, type: .nappy, occurredAt: item.occurredAt, createdBy: item.userId)
            new.dirty = item.dirty
            _ = try? await supabase.from("entries").insert(new).execute()
        }
        QuickQueue.clear()
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

    /// False until the stored session has been checked on launch. Rendering
    /// AuthView before then flashes the sign-in screen (and its auto-focused
    /// keyboard) at already-signed-in users.
    @Published var authResolved = false

    /// Follow Supabase auth state for the app's lifetime (initial session,
    /// sign-in, sign-out, token refresh).
    func listenToAuth() async {
        for await state in supabase.auth.authStateChanges {
            if [.initialSession, .signedIn, .signedOut, .tokenRefreshed].contains(state.event) {
                session = state.session
                authResolved = true
                // Keep the widget/Siri token fresh across refreshes.
                if state.event == .tokenRefreshed { writeQuickCreds() }
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
        QuickCreds.clear()
        try? await supabase.auth.signOut()
    }

    // MARK: - Data

    /// Baby context + a rolling window of entries + day tags, in parallel.
    func refresh() async {
        guard session != nil else { return }
        loading = entries.isEmpty
        defer { loading = false }
        await flushQuickQueue()
        do {
            if baby == nil {
                let fetched: [Membership] = try await supabase
                    .from("baby_members")
                    .select("role, baby:babies(*)")
                    .order("created_at", ascending: true)
                    .execute().value
                memberships = fetched
                let activeId = UserDefaults.standard.string(forKey: "active-baby").flatMap(UUID.init)
                let active = fetched.first { $0.baby.id == activeId } ?? fetched.first
                baby = active?.baby
                role = active?.role ?? "caregiver"
            }
            guard let baby else { return }

            let since = Calendar.current.date(byAdding: .day, value: -60, to: .now)!
            async let entriesReq: [Entry] = supabase
                .from("entries")
                .select()
                .eq("baby_id", value: baby.id)
                .gte("occurred_at", value: since.ISO8601Format())
                .order("occurred_at", ascending: false)
                .execute().value
            async let tagsReq: [DayTag] = supabase
                .from("baby_day_tags")
                .select()
                .eq("baby_id", value: baby.id)
                .execute().value
            // Medication courses can start long before the entries window.
            let nowISO = Date().ISO8601Format()
            async let coursesReq: [Entry] = supabase
                .from("entries")
                .select()
                .eq("baby_id", value: baby.id)
                .eq("type", value: "medication")
                .or("med_kind.is.null,med_kind.neq.dose")
                .lte("occurred_at", value: nowISO)
                .or("ended_at.is.null,ended_at.gte.\(nowISO)")
                .execute().value
            async let profileReq: [Profile] = supabase
                .from("profiles")
                .select()
                .eq("id", value: session!.user.id)
                .execute().value
            async let settingsReq: [UserSettings] = supabase
                .from("user_settings")
                .select("appear_offline, read_receipts")
                .eq("user_id", value: session!.user.id)
                .execute().value
            entries = try await entriesReq
            dayTags = try await tagsReq
            activeCourses = (try? await coursesReq) ?? []
            myProfile = try await profileReq.first
            mySettings = (try? await settingsReq.first) ?? UserSettings()
            await refreshUnreadDMs()
            signedUrlCache = [:]
            errorMessage = nil
            writeWidgetSnapshot()
            // A timer started pre-load now gets its Live Activity (with the
            // real baby name).
            syncLiveActivity()
        } catch {
            errorMessage = friendly(error)
        }
    }

    /// A friend chat is open — hide the floating log button so it doesn't
    /// sit on top of the message input.
    @Published var chatThreadOpen = false

    /// Unread DMs badge on the Friends tab — mirrors the web's UnreadBadge.
    @Published var unreadDMs = 0
    func refreshUnreadDMs() async {
        guard let userId else { return }
        let count = try? await supabase
            .from("direct_messages")
            .select("id", head: true, count: .exact)
            .eq("recipient", value: userId)
            .is("read_at", value: nil)
            .execute().count
        unreadDMs = count ?? unreadDMs
    }

    /// Older entries for History: pull the next 60-day window and append.
    @Published var hasMoreHistory = true
    func loadOlderEntries() async {
        guard let baby, let oldest = entries.map(\.occurredAt).min() else { return }
        do {
            let since = Calendar.current.date(byAdding: .day, value: -60, to: oldest)!
            let older: [Entry] = try await supabase
                .from("entries")
                .select()
                .eq("baby_id", value: baby.id)
                .gte("occurred_at", value: since.ISO8601Format())
                .lt("occurred_at", value: oldest.ISO8601Format())
                .order("occurred_at", ascending: false)
                .execute().value
            let known = Set(entries.map(\.id))
            entries.append(contentsOf: older.filter { !known.contains($0.id) })
            hasMoreHistory = !older.isEmpty && baby.birthAt < since
        } catch {
            errorMessage = friendly(error)
        }
    }

    /// Switch the active baby (multi-baby households) and reload everything.
    func switchBaby(_ id: UUID) async {
        guard let membership = memberships.first(where: { $0.baby.id == id }) else { return }
        UserDefaults.standard.set(id.uuidString, forKey: "active-baby")
        baby = membership.baby
        role = membership.role
        entries = []
        dayTags = []
        carers = []
        await refresh()
    }

    // MARK: - Photos (private nappy-photos bucket)

    /// Short-TTL signed URLs for photo paths, cached per refresh cycle.
    private var signedUrlCache: [String: URL] = [:]

    func signedPhotoURL(_ path: String) async -> URL? {
        if let hit = signedUrlCache[path] { return hit }
        guard let signed = try? await supabase.storage
            .from("nappy-photos")
            .createSignedURL(path: path, expiresIn: 600) else { return nil }
        signedUrlCache[path] = signed
        return signed
    }

    /// Upload a compressed JPEG for an entry; returns the storage path.
    func uploadNappyPhoto(_ data: Data, entryId: UUID) async throws -> String {
        guard let baby else { throw URLError(.badURL) }
        let path = "\(baby.id.uuidString.lowercased())/\(entryId.uuidString.lowercased()).jpg"
        _ = try await supabase.storage.from("nappy-photos").upload(
            path,
            data: data,
            options: FileOptions(contentType: "image/jpeg", upsert: true)
        )
        return path
    }

    // MARK: - Bea API (bearer-authenticated calls to the web backend)

    /// POST JSON to a beanlo API route with the user's access token.
    func apiRequest(_ path: String, body: [String: Any]) async throws -> URLRequest {
        guard let token = session?.accessToken else { throw URLError(.userAuthenticationRequired) }
        var request = URLRequest(url: Store.webBase.appendingPathComponent(path))
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        return request
    }

    // MARK: - Presence (mirrors the web PresencePublisher)

    func publishPresence() async {
        guard let userId else { return }
        if mySettings.appearOffline == true { return }
        struct P: Encodable {
            let presence_status: String
            let presence_at: String
        }
        let status = feedTimer.isRunning ? "feeding" : "online"
        _ = try? await supabase
            .from("profiles")
            .update(P(presence_status: status, presence_at: Date().ISO8601Format()))
            .eq("id", value: userId)
            .execute()
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

    @discardableResult
    func save(_ new: NewEntry) async throws -> Entry {
        let inserted: Entry = try await supabase
            .from("entries")
            .insert(new)
            .select()
            .single()
            .execute().value
        entries.insert(inserted, at: entries.firstIndex { $0.occurredAt < inserted.occurredAt } ?? entries.count)
        writeWidgetSnapshot()
        Haptics.success()
        return inserted
    }

    /// Attach an uploaded photo path to an existing entry.
    func setPhotoPath(_ path: String, entryId: UUID) async {
        struct P: Encodable { let photo_path: String }
        _ = try? await supabase.from("entries")
            .update(P(photo_path: path))
            .eq("id", value: entryId)
            .execute()
        if let i = entries.firstIndex(where: { $0.id == entryId }) {
            entries[i].photoPath = path
        }
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

    // MARK: - Account & data management (Settings parity)

    func updateSetting(appearOffline: Bool? = nil, readReceipts: Bool? = nil) async {
        guard let userId else { return }
        struct Row: Encodable {
            let user_id: UUID
            let appear_offline: Bool?
            let read_receipts: Bool?
        }
        var next = mySettings
        if let appearOffline { next.appearOffline = appearOffline }
        if let readReceipts { next.readReceipts = readReceipts }
        mySettings = next
        _ = try? await supabase.from("user_settings")
            .upsert(Row(user_id: userId, appear_offline: next.appearOffline, read_receipts: next.readReceipts), onConflict: "user_id")
            .execute()
        if appearOffline == false { await publishPresence() }
    }

    func uploadAvatar(_ jpeg: Data) async throws {
        guard let userId else { return }
        let path = "\(userId.uuidString.lowercased()).jpg"
        _ = try await supabase.storage.from("avatars").upload(
            path, data: jpeg, options: FileOptions(contentType: "image/jpeg", upsert: true)
        )
        let publicURL = try supabase.storage.from("avatars").getPublicURL(path: path)
        struct A: Encodable { let avatar_url: String }
        _ = try await supabase.from("profiles")
            .update(A(avatar_url: publicURL.absoluteString + "?v=\(Int(Date().timeIntervalSince1970))"))
            .eq("id", value: userId)
            .execute()
        myProfile?.avatarUrl = publicURL.absoluteString
        Haptics.success()
    }

    /// Owner only (RLS enforces): removes the baby for every carer.
    func deleteBaby() async throws {
        guard let baby else { return }
        try await supabase.from("babies").delete().eq("id", value: baby.id).execute()
        self.baby = nil
        memberships.removeAll { $0.baby.id == baby.id }
        entries = []
        await refresh()
    }

    /// Non-owners: give up access to the active baby.
    func leaveBaby() async throws {
        guard let baby, let userId else { return }
        try await supabase.from("baby_members")
            .delete()
            .eq("baby_id", value: baby.id)
            .eq("user_id", value: userId)
            .execute()
        self.baby = nil
        memberships.removeAll { $0.baby.id == baby.id }
        await refresh()
    }

    /// Full account deletion via the web backend (needs the service role).
    func deleteAccount() async throws {
        let request = try await apiRequest("/api/account/delete", body: [:])
        let (_, response) = try await URLSession.shared.data(for: request)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }
        await signOut()
    }

    /// Batched inserts for the Huckleberry import; returns (imported, skipped-duplicates).
    func importEntries(_ drafts: [NewEntry]) async throws -> (imported: Int, duplicates: Int) {
        guard baby != nil else { return (0, 0) }
        let times = drafts.map(\.occurredAt)
        guard let minT = times.min(), let maxT = times.max() else { return (0, 0) }
        struct Existing: Decodable {
            let type: EntryType
            let occurredAt: Date
            enum CodingKeys: String, CodingKey {
                case type
                case occurredAt = "occurred_at"
            }
        }
        let existing: [Existing] = try await supabase
            .from("entries")
            .select("type, occurred_at")
            .eq("baby_id", value: baby!.id)
            .gte("occurred_at", value: minT.ISO8601Format())
            .lte("occurred_at", value: maxT.ISO8601Format())
            .execute().value
        let seen = Set(existing.map { "\($0.type.rawValue)|\(Int($0.occurredAt.timeIntervalSince1970))" })
        let fresh = drafts.filter { !seen.contains("\($0.type.rawValue)|\(Int($0.occurredAt.timeIntervalSince1970))") }

        // Insert per type: bulk inserts union keys across rows, which would
        // trip not-null defaults like med_kind (learned on the web importer).
        var imported = 0
        for type in Set(fresh.map(\.type)) {
            let group = fresh.filter { $0.type == type }
            for chunkStart in stride(from: 0, to: group.count, by: 200) {
                let chunk = Array(group[chunkStart..<min(chunkStart + 200, group.count)])
                try await supabase.from("entries").insert(chunk).execute()
                imported += chunk.count
            }
        }
        await refresh()
        return (imported, drafts.count - fresh.count)
    }

    func removeImportedEntries() async throws -> Int {
        guard let baby else { return 0 }
        struct Row: Decodable { let id: UUID }
        let removed: [Row] = try await supabase
            .from("entries")
            .delete()
            .eq("baby_id", value: baby.id)
            .eq("source", value: "huckleberry")
            .select("id")
            .execute().value
        await refresh()
        return removed.count
    }

    /// Full-history CSV, matching the web export's spirit.
    func csvExport() async -> String {
        guard let baby else { return "" }
        let all: [Entry] = (try? await supabase
            .from("entries")
            .select()
            .eq("baby_id", value: baby.id)
            .order("occurred_at", ascending: true)
            .execute().value) ?? entries.sorted { $0.occurredAt < $1.occurredAt }
        let f = ISO8601DateFormatter()
        var lines = ["type,occurred_at,ended_at,wet,dirty,stool_colour,left_min,right_min,expressed_ml,formula_ml,weight_g,length_mm,head_circ_mm,temp_c,med_name,med_dose,note"]
        func quote(_ s: String?) -> String {
            guard let s, !s.isEmpty else { return "" }
            return "\"\(s.replacingOccurrences(of: "\"", with: "\"\""))\""
        }
        func num(_ n: Int?) -> String { n.map { String($0) } ?? "" }
        for e in all {
            var cols: [String] = []
            cols.append(e.type.rawValue)
            cols.append(f.string(from: e.occurredAt))
            cols.append(e.endedAt.map { f.string(from: $0) } ?? "")
            cols.append(e.wet.map { String($0) } ?? "")
            cols.append(e.dirty.map { String($0) } ?? "")
            cols.append(e.stoolColour ?? "")
            cols.append(num(e.leftMin))
            cols.append(num(e.rightMin))
            cols.append(num(e.expressedMl))
            cols.append(num(e.formulaMl))
            cols.append(num(e.weightG))
            cols.append(num(e.lengthMm))
            cols.append(num(e.headCircMm))
            cols.append(e.tempC.map { String($0) } ?? "")
            cols.append(quote(e.medName))
            cols.append(quote(e.medDose))
            cols.append(quote(e.note))
            lines.append(cols.joined(separator: ","))
        }
        return lines.joined(separator: "\n")
    }

    private func friendly(_ error: Error) -> String {
        let text = error.localizedDescription
        if text.localizedCaseInsensitiveContains("network") || text.localizedCaseInsensitiveContains("internet") {
            return "No connection — your entries are safe, try again when you're back online."
        }
        return text
    }
}
