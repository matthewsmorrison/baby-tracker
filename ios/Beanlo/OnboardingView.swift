import SwiftUI

/// First run with no baby yet: a staged flow that gathers what the app
/// actually needs (name → birth → weight → sex → tracking → rhythm),
/// creates the baby, then primes notifications and the partner invite.
/// `store.refresh()` runs only at the very end — the root view swaps to
/// the app the moment memberships load, which would cut the flow short.
struct OnboardingView: View {
    @EnvironmentObject private var store: Store

    enum Step: Int, CaseIterable {
        case welcome, name, birth, weight, sex, tracking, rhythm, alerts, invite
    }

    @State private var step: Step = .welcome
    @State private var goingBack = false

    // Answers
    @State private var name = ""
    @State private var birthAt = Calendar.current.date(byAdding: .day, value: -3, to: .now) ?? .now
    @State private var weightUnit = "kg"
    @State private var kgText = ""
    @State private var lbText = ""
    @State private var ozText = ""
    @State private var sex: String?
    @State private var tracked: Set<String> = ["nappy", "feed", "sleep", "weight"]
    @State private var intervalMin = 180

    // Flow state
    @State private var baby: Baby?
    @State private var busy = false
    @State private var error: String?

    // Invite step
    @State private var inviteEmail = ""
    @State private var inviteLink: String?
    @FocusState private var focusedField: Bool

    private let trackChoices: [(String, String, String)] = [
        ("nappy", "Nappies", "drop.fill"),
        ("feed", "Feeds", "waterbottle.fill"),
        ("sleep", "Sleep", "moon.zzz.fill"),
        ("weight", "Weight & growth", "scalemass.fill"),
        ("pump", "Pumping", "drop.circle.fill"),
        ("carer_sleep", "Your own sleep", "bed.double.fill"),
        ("temperature", "Temperature", "thermometer"),
        ("milestone", "Milestones", "star.fill"),
        ("medication", "Medicines", "pills.fill"),
    ]

    var body: some View {
        ZStack {
            SkyBackground()
            VStack(spacing: 0) {
                header
                ScrollView {
                    Group {
                        switch step {
                        case .welcome: welcome
                        case .name: nameStep
                        case .birth: birthStep
                        case .weight: weightStep
                        case .sex: sexStep
                        case .tracking: trackingStep
                        case .rhythm: rhythmStep
                        case .alerts: alertsStep
                        case .invite: inviteStep
                        }
                    }
                    .padding(.horizontal, 24)
                    .padding(.top, 8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .transition(.asymmetric(
                        insertion: .move(edge: goingBack ? .leading : .trailing).combined(with: .opacity),
                        removal: .move(edge: goingBack ? .trailing : .leading).combined(with: .opacity)
                    ))
                    .id(step)
                }
                .scrollDismissesKeyboard(.interactively)
                footer
            }
        }
        .animation(.snappy(duration: 0.32), value: step)
        #if DEBUG
        .onAppear {
            if let raw = UserDefaults.standard.string(forKey: "DevOnboardStep"),
               let idx = Step.allCases.firstIndex(where: { "\($0)" == raw }) {
                step = Step.allCases[idx]
            }
        }
        #endif
    }

    // MARK: - Chrome

    private var header: some View {
        HStack {
            Button {
                Haptics.tap()
                goingBack = true
                withAnimation { step = Step(rawValue: step.rawValue - 1) ?? .welcome }
                DispatchQueue.main.async { goingBack = false }
            } label: {
                Image(systemName: "chevron.left")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(Color.muted)
                    .frame(width: 38, height: 38)
                    .glassEffect(.regular, in: .circle)
            }
            .opacity(step == .welcome || step == .alerts || step == .invite ? 0 : 1)
            .disabled(step == .welcome || baby != nil)

            Spacer()

            // Progress dots — the post-creation steps count too.
            HStack(spacing: 5) {
                ForEach(Step.allCases, id: \.rawValue) { s in
                    Capsule()
                        .fill(s.rawValue <= step.rawValue ? Color.accent : Color.line)
                        .frame(width: s == step ? 18 : 6, height: 6)
                }
            }
            Spacer()
            Color.clear.frame(width: 38, height: 38)
        }
        .padding(.horizontal, 20)
        .padding(.top, 12)
    }

    @ViewBuilder
    private var footer: some View {
        VStack(spacing: 10) {
            if let error {
                Text(error).font(.footnote).foregroundStyle(Color.alertTone)
            }
            Button {
                Task { await advance() }
            } label: {
                Group {
                    if busy { ProgressView() } else { Text(primaryLabel) }
                }
                .font(.system(.body, design: .rounded, weight: .semibold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
            }
            .buttonStyle(.glassProminent)
            .disabled(busy || !stepValid)

            if let skip = skipLabel {
                Button(skip) {
                    Haptics.tap()
                    Task { await skipStep() }
                }
                .font(.footnote)
                .foregroundStyle(Color.muted)
                .disabled(busy)
            }
        }
        .padding(.horizontal, 24)
        .padding(.bottom, 18)
    }

    private var primaryLabel: String {
        switch step {
        case .welcome: return "Let's set up"
        case .rhythm: return "Create \(name.isEmpty ? "baby" : name)'s tracker"
        case .alerts: return "Turn on reminders"
        case .invite: return inviteLink == nil ? "Send the invite" : "Start tracking"
        default: return "Continue"
        }
    }

    private var skipLabel: String? {
        switch step {
        case .sex: return sex == nil ? "Skip for now" : nil
        case .alerts: return "Not now"
        case .invite: return inviteLink == nil ? "I'll do this later" : nil
        default: return nil
        }
    }

    private var stepValid: Bool {
        switch step {
        case .name: return !name.trimmingCharacters(in: .whitespaces).isEmpty
        case .weight: return birthWeightG != nil
        case .sex: return sex != nil
        case .tracking: return !tracked.isEmpty
        case .invite: return inviteLink != nil || inviteEmail.contains("@")
        default: return true
        }
    }

    private var birthWeightG: Int? {
        if weightUnit == "kg" {
            guard let kg = Double(kgText.replacingOccurrences(of: ",", with: ".")), kg > 0.2, kg < 8 else { return nil }
            return Int(kg * 1000)
        }
        let lb = Double(lbText) ?? 0
        let oz = Double(ozText) ?? 0
        guard lb + oz > 0 else { return nil }
        let g = lb * 453.592 + oz * 28.3495
        return g > 200 && g < 8000 ? Int(g) : nil
    }

    // MARK: - Steps

    private var welcome: some View {
        VStack(alignment: .leading, spacing: 18) {
            Image(systemName: "flame")
                .font(.system(size: 40, weight: .medium))
                .foregroundStyle(Color.accent)
                .padding(20)
                .glassEffect(.regular, in: .circle)
                .padding(.top, 30)
            Text("Welcome to Beanlo")
                .font(.stat(34))
                .foregroundStyle(Color.ink)
            Text("A few quick questions and you're tracking. Everything can be changed later in Settings.")
                .font(.system(.body, design: .rounded))
                .foregroundStyle(Color.muted)
            VStack(alignment: .leading, spacing: 12) {
                welcomeRow("drop.fill", "Log a feed or nappy in one tap")
                welcomeRow("chart.line.uptrend.xyaxis", "Growth on the same centiles as your red book")
                welcomeRow("person.2.fill", "Share it all with your partner")
            }
            .padding(.top, 6)
        }
    }

    private func welcomeRow(_ symbol: String, _ text: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: symbol)
                .font(.subheadline)
                .foregroundStyle(Color.accent)
                .frame(width: 34, height: 34)
                .background(Color.accentSoft, in: .circle)
            Text(text)
                .font(.system(.subheadline, design: .rounded, weight: .medium))
                .foregroundStyle(Color.ink)
        }
    }

    private var nameStep: some View {
        VStack(alignment: .leading, spacing: 10) {
            stepTitle("What's your baby's name?")
            stepSub("Or a nickname — plenty of beans arrive before their name does.")
            TextField("Name", text: $name)
                .font(.stat(30))
                .focused($focusedField)
                .padding(18)
                .glassEffect(.regular, in: .rect(cornerRadius: 20))
                .onAppear { focusedField = true }
        }
    }

    private var birthStep: some View {
        VStack(alignment: .leading, spacing: 10) {
            stepTitle("When was \(name) born?")
            stepSub("Day of life drives everything — expected nappies, weight ranges, wake windows.")
            DatePicker("Born", selection: $birthAt, in: ...Date(), displayedComponents: [.date, .hourAndMinute])
                .datePickerStyle(.graphical)
                .padding(12)
                .glassEffect(.regular, in: .rect(cornerRadius: 24))
        }
    }

    private var weightStep: some View {
        VStack(alignment: .leading, spacing: 10) {
            stepTitle("Birth weight")
            stepSub("From the red book or hospital notes — it anchors the growth charts.")
            Picker("Units", selection: $weightUnit) {
                Text("kg").tag("kg")
                Text("lb & oz").tag("lb")
            }
            .pickerStyle(.segmented)
            if weightUnit == "kg" {
                HStack {
                    TextField("3.42", text: $kgText)
                        .keyboardType(.decimalPad)
                        .font(.stat(34))
                    Text("kg").font(.title3).foregroundStyle(Color.muted)
                }
                .padding(18)
                .glassEffect(.regular, in: .rect(cornerRadius: 20))
            } else {
                HStack(spacing: 10) {
                    HStack {
                        TextField("7", text: $lbText)
                            .keyboardType(.numberPad)
                            .font(.stat(34))
                        Text("lb").font(.title3).foregroundStyle(Color.muted)
                    }
                    .padding(18)
                    .glassEffect(.regular, in: .rect(cornerRadius: 20))
                    HStack {
                        TextField("8", text: $ozText)
                            .keyboardType(.numberPad)
                            .font(.stat(34))
                        Text("oz").font(.title3).foregroundStyle(Color.muted)
                    }
                    .padding(18)
                    .glassEffect(.regular, in: .rect(cornerRadius: 20))
                }
                if let g = birthWeightG {
                    Text(String(format: "= %.2f kg", Double(g) / 1000))
                        .font(.footnote)
                        .foregroundStyle(Color.muted)
                }
            }
        }
    }

    private var sexStep: some View {
        VStack(alignment: .leading, spacing: 10) {
            stepTitle("Boy or girl?")
            stepSub("Only used to pick the right WHO growth curves — boys and girls have different centile charts.")
            HStack(spacing: 10) {
                bigChoice("Boy", active: sex == "boy") { sex = "boy" }
                bigChoice("Girl", active: sex == "girl") { sex = "girl" }
            }
        }
    }

    private var trackingStep: some View {
        VStack(alignment: .leading, spacing: 10) {
            stepTitle("What do you want to track?")
            stepSub("Start light — you can switch any of these on or off later.")
            VStack(spacing: 8) {
                ForEach(trackChoices, id: \.0) { key, label, symbol in
                    Button {
                        Haptics.tap()
                        if tracked.contains(key) { tracked.remove(key) } else { tracked.insert(key) }
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: symbol)
                                .font(.subheadline)
                                .foregroundStyle(tracked.contains(key) ? Color.accent : Color.faint)
                                .frame(width: 30)
                            Text(label)
                                .font(.system(.body, design: .rounded, weight: .medium))
                                .foregroundStyle(Color.ink)
                            Spacer()
                            Image(systemName: tracked.contains(key) ? "checkmark.circle.fill" : "circle")
                                .foregroundStyle(tracked.contains(key) ? Color.accent : Color.line)
                                .font(.title3)
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                        .background(
                            tracked.contains(key) ? Color.accentSoft.opacity(0.6) : Color.surface.opacity(0.6),
                            in: .rect(cornerRadius: 16)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var rhythmStep: some View {
        VStack(alignment: .leading, spacing: 10) {
            stepTitle("How often are you aiming to feed?")
            stepSub("Newborns usually feed every 2–4 hours. This sets when Beanlo nudges you — feeding on cues always wins.")
            HStack(spacing: 8) {
                ForEach([120, 150, 180, 210, 240], id: \.self) { mins in
                    bigChoice(
                        mins % 60 == 0 ? "\(mins / 60)h" : "\(mins / 60)½h",
                        active: intervalMin == mins
                    ) { intervalMin = mins }
                }
            }
        }
    }

    private var alertsStep: some View {
        VStack(alignment: .leading, spacing: 10) {
            celebration
            stepTitle("Want a nudge when a feed is due?")
            stepSub("A quiet notification when \(name)'s next feed comes around, when nappies run low, and when medicines are due. No spam — you can switch it off any time.")
        }
    }

    private var inviteStep: some View {
        VStack(alignment: .leading, spacing: 10) {
            stepTitle("Bring in your partner")
            stepSub("Whoever shares the care sees the same live picture — every feed and nappy, whoever logged it. The 3am shift is a team sport.")
            if let inviteLink {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Invite created — send them this link:")
                        .font(.system(.subheadline, design: .rounded, weight: .semibold))
                    Text(inviteLink)
                        .font(.footnote.monospaced())
                        .foregroundStyle(Color.muted)
                        .lineLimit(2)
                    if let url = URL(string: inviteLink) {
                        ShareLink(item: url) {
                            Label("Share the link", systemImage: "square.and.arrow.up")
                                .font(.system(.subheadline, design: .rounded, weight: .semibold))
                        }
                        .buttonStyle(.glass)
                    }
                }
                .padding(16)
                .glassEffect(.regular, in: .rect(cornerRadius: 20))
            } else {
                TextField("their@email.com", text: $inviteEmail)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .font(.system(.body, design: .rounded))
                    .padding(16)
                    .glassEffect(.regular, in: .rect(cornerRadius: 18))
            }
        }
    }

    private var celebration: some View {
        HStack(spacing: 10) {
            Image(systemName: "checkmark.seal.fill")
                .foregroundStyle(Color.positive)
            Text("\(name)'s tracker is ready")
                .font(.system(.subheadline, design: .rounded, weight: .bold))
                .foregroundStyle(Color.positive)
        }
        .padding(.bottom, 8)
    }

    private func stepTitle(_ text: String) -> some View {
        Text(text).font(.stat(30)).foregroundStyle(Color.ink)
    }

    private func stepSub(_ text: String) -> some View {
        Text(text)
            .font(.system(.subheadline, design: .rounded))
            .foregroundStyle(Color.muted)
            .padding(.bottom, 8)
    }

    private func bigChoice(_ label: String, active: Bool, action: @escaping () -> Void) -> some View {
        Button {
            Haptics.tap()
            action()
        } label: {
            Text(label)
                .font(.system(.body, design: .rounded, weight: .semibold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(active ? Color.ink : Color.surface.opacity(0.7), in: .rect(cornerRadius: 16))
                .foregroundStyle(active ? Color.onInk : Color.ink)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Flow

    private func advance() async {
        Haptics.tap()
        error = nil
        switch step {
        case .rhythm:
            await createBaby()
        case .alerts:
            busy = true
            _ = await store.enablePush()
            busy = false
            step = .invite
        case .invite:
            if inviteLink == nil {
                await createInvite()
            } else {
                await finish()
            }
        default:
            step = Step(rawValue: step.rawValue + 1) ?? step
        }
    }

    private func skipStep() async {
        switch step {
        case .sex:
            sex = nil
            step = .tracking
        case .alerts:
            step = .invite
        case .invite:
            await finish()
        default:
            break
        }
    }

    private func createBaby() async {
        guard let userId = store.userId, let weightG = birthWeightG else { return }
        busy = true
        struct NewBaby: Encodable {
            let name: String
            let birth_at: String
            let birth_weight_g: Int
            let sex: String?
            let created_by: UUID
            let tracked_types: [String]
            let feed_interval_min: Int
        }
        do {
            let created: Baby = try await store.supabase.from("babies").insert(NewBaby(
                name: name.trimmingCharacters(in: .whitespaces),
                birth_at: birthAt.ISO8601Format(),
                birth_weight_g: weightG,
                sex: sex,
                created_by: userId,
                tracked_types: Array(tracked),
                feed_interval_min: intervalMin
            )).select().single().execute().value
            baby = created
            Haptics.success()
            step = .alerts
        } catch {
            self.error = "Couldn't create the tracker — check the details and try again."
        }
        busy = false
    }

    private func createInvite() async {
        guard let baby, let userId = store.userId else { return }
        busy = true
        struct NewInvite: Encodable {
            let baby_id: UUID
            let email: String
            let role: String
            let invited_by: UUID
        }
        struct Created: Decodable { let token: UUID }
        do {
            let created: Created = try await store.supabase.from("baby_invites")
                .insert(NewInvite(
                    baby_id: baby.id,
                    email: inviteEmail.lowercased().trimmingCharacters(in: .whitespaces),
                    role: "caregiver",
                    invited_by: userId
                ))
                .select("token")
                .single()
                .execute().value
            inviteLink = "https://beanlo.com/invite/\(created.token.uuidString.lowercased())"
            Haptics.success()
        } catch {
            self.error = "Couldn't create the invite — you can also do it later in Settings."
        }
        busy = false
    }

    private func finish() async {
        busy = true
        await store.refresh()
        busy = false
        Haptics.success()
    }
}
