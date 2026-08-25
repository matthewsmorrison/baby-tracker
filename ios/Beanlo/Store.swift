import Foundation
import Supabase

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
    @Published var entries: [Entry] = []
    @Published var dayTags: [DayTag] = []
    @Published var loading = false
    @Published var errorMessage: String?

    var userId: UUID? { session?.user.id }

    var trackedTypes: [EntryType] {
        let tracked = baby?.trackedTypes ?? ["nappy", "feed", "sleep", "weight"]
        let order: [EntryType] = [.nappy, .feed, .sleep, .weight, .pump, .carerSleep, .temperature, .milestone, .medication]
        return order.filter { tracked.contains($0.rawValue) }
    }

    private init() {}

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
            }
            guard let baby else { return }

            let since = Calendar.current.date(byAdding: .day, value: -60, to: .now)!
            async let entriesReq: [Entry] = supabase
                .from("entries")
                .select("id, baby_id, type, occurred_at, ended_at, wet, dirty, nappy_weight_g, feed_type, left_min, right_min, expressed_ml, formula_ml, volume_ml, weight_g, temp_c, med_name, med_dose, med_kind, med_subject, milestone_label, note, source")
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
        } catch {
            errorMessage = friendly(error)
        }
    }

    func save(_ new: NewEntry) async throws {
        let inserted: Entry = try await supabase
            .from("entries")
            .insert(new)
            .select()
            .single()
            .execute().value
        entries.insert(inserted, at: entries.firstIndex { $0.occurredAt < inserted.occurredAt } ?? entries.count)
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
        Haptics.success()
    }

    func delete(_ entry: Entry) async throws {
        try await supabase.from("entries").delete().eq("id", value: entry.id).execute()
        entries.removeAll { $0.id == entry.id }
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
