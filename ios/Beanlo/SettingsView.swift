import SwiftUI
import PhotosUI
import Supabase

struct SettingsView: View {
    @EnvironmentObject private var store: Store
    @AppStorage("appearance") private var appearance = "system"
    // Sheets live up here, not on the Section: modifiers inside a lazy List
    // are torn down when the list re-renders, which dismissed the sheet the
    // moment it opened.
    @State private var editingCourse: Entry?
    @State private var showNewCourse = false

    var body: some View {
        List {
            if store.memberships.count > 1 {
                Section("Active baby") {
                    Picker("Baby", selection: Binding(
                        get: { store.baby?.id ?? UUID() },
                        set: { id in Task { await store.switchBaby(id) } }
                    )) {
                        ForEach(store.memberships, id: \.baby.id) { m in
                            Text(m.baby.name).tag(m.baby.id)
                        }
                    }
                }
                .listRowBackground(Color.surface)
            }

            if let baby = store.baby {
                BabySection(baby: baby, canEdit: store.isOwner)
                TrackingSection(baby: baby, canEdit: store.isOwner)
                CarersSection()
                if store.isOwner {
                    InvitesSection()
                }
                MedCoursesSection(editingCourse: $editingCourse, showNewCourse: $showNewCourse)
            }

            Section {
                Toggle(isOn: Binding(
                    get: { store.pushEnabled },
                    set: { on in
                        Task { on ? _ = await store.enablePush() : await store.disablePush() }
                    }
                )) {
                    Label("Notifications", systemImage: "bell.badge.fill")
                }
                .tint(.accent)
            } header: {
                Text("Alerts")
            } footer: {
                Text("Feed-due nudges, nappy watch and medication reminders — the same alerts as the web app, delivered natively.")
            }
            .listRowBackground(Color.surface)

            AccountSection(appearance: $appearance)
            DataSection()
            DangerSection()
        }
        .scrollContentBackground(.hidden)
        .background(Color.sand)
        .navigationTitle("Settings")
        .task { await store.loadCarers() }
        .sheet(item: $editingCourse) { course in
            LogSheet(initialType: .medication, editing: course)
        }
        .sheet(isPresented: $showNewCourse) {
            LogSheet(initialType: .medication, startAsCourse: true)
        }
    }
}

// MARK: - Medication courses (mirrors the web's Profile manager)

private struct MedCoursesSection: View {
    @EnvironmentObject private var store: Store
    @Binding var editingCourse: Entry?
    @Binding var showNewCourse: Bool

    var body: some View {
        Section {
            if store.activeCourses.isEmpty {
                Text("No ongoing medication courses.")
                    .font(.footnote)
                    .foregroundStyle(Color.muted)
            }
            ForEach(store.activeCourses) { course in
                VStack(alignment: .leading, spacing: 2) {
                    HStack {
                        Text(course.medName ?? "Medicine")
                            .font(.system(.body, design: .rounded, weight: .semibold))
                        Text(course.medSubject == "baby" ? "baby" : "mother")
                            .font(.caption2.weight(.semibold))
                            .padding(.horizontal, 7)
                            .padding(.vertical, 2)
                            .background(Color.accentSoft, in: .capsule)
                            .foregroundStyle(Color.accent)
                        Spacer()
                        if store.canEdit {
                            Menu {
                                Button("Edit") { editingCourse = course }
                                Button("Stop course") {
                                    Task {
                                        var stopped = course
                                        stopped.endedAt = Date()
                                        try? await store.update(stopped)
                                        await store.refresh()
                                    }
                                }
                                Button("Delete", role: .destructive) {
                                    Task {
                                        try? await store.delete(course)
                                        await store.refresh()
                                    }
                                }
                            } label: {
                                Image(systemName: "ellipsis").foregroundStyle(Color.faint)
                            }
                        }
                    }
                    HStack(spacing: 8) {
                        if let dose = course.medDose {
                            Text(dose).font(.caption).foregroundStyle(Color.muted)
                        }
                        Text("since \(course.occurredAt.formatted(.dateTime.day().month(.abbreviated)))")
                            .font(.caption).foregroundStyle(Color.muted)
                        if let times = course.reminderTimes, !times.isEmpty {
                            Label(times.joined(separator: ", "), systemImage: "bell")
                                .font(.caption).foregroundStyle(Color.muted)
                        }
                    }
                }
            }
            if store.canEdit {
                Button {
                    showNewCourse = true
                } label: {
                    Label("Add a medication", systemImage: "plus")
                }
            }
        } header: {
            Text("Medication courses")
        } footer: {
            Text("Ongoing medicines (baby's or mother's). Some medication passes into breastmilk and can shift stool colour.")
        }
        .listRowBackground(Color.surface)
    }
}

// MARK: - Invites (owner)

private struct InvitesSection: View {
    @EnvironmentObject private var store: Store
    @State private var invites: [BabyInvite] = []
    @State private var email = ""
    @State private var role = "caregiver"
    @State private var message: String?
    @State private var copiedId: UUID?

    var body: some View {
        Section {
            HStack(spacing: 8) {
                TextField("their@email.com", text: $email)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                Button("Invite") {
                    Task { await create() }
                }
                .font(.caption.weight(.semibold))
                .buttonStyle(.borderedProminent)
                .tint(.accent)
                .disabled(!email.contains("@"))
            }
            Picker("Role", selection: $role) {
                Text("Carer — can log & edit").tag("caregiver")
                Text("Healthcare — read-only").tag("viewer")
            }
            if let message {
                Text(message).font(.caption).foregroundStyle(Color.muted)
            }
            ForEach(invites) { invite in
                HStack {
                    VStack(alignment: .leading, spacing: 1) {
                        Text(invite.email).font(.system(.subheadline, design: .rounded))
                        Text("\(invite.role == "viewer" ? "healthcare · read-only" : "carer") · pending")
                            .font(.caption2).foregroundStyle(Color.muted)
                    }
                    Spacer()
                    Button(copiedId == invite.id ? "Copied" : "Link") {
                        UIPasteboard.general.string = "https://beanlo.com/invite/\(invite.token.uuidString.lowercased())"
                        copiedId = invite.id
                        Haptics.success()
                    }
                    .font(.caption.weight(.semibold))
                    Button("Revoke", role: .destructive) {
                        Task { await revoke(invite) }
                    }
                    .font(.caption)
                }
            }
        } header: {
            Text("Invite someone")
        } footer: {
            Text("Share the invite link yourself — Beanlo doesn't email it. The invited person accepts it on beanlo.com.")
        }
        .listRowBackground(Color.surface)
        .task { await load() }
    }

    private func load() async {
        guard let baby = store.baby else { return }
        invites = (try? await store.supabase
            .from("baby_invites")
            .select("id, email, role, token, status")
            .eq("baby_id", value: baby.id)
            .eq("status", value: "pending")
            .order("created_at", ascending: false)
            .execute().value) ?? []
    }

    private func create() async {
        guard let baby = store.baby, let userId = store.userId else { return }
        struct NewInvite: Encodable {
            let baby_id: UUID
            let email: String
            let role: String
            let invited_by: UUID
        }
        do {
            _ = try await store.supabase.from("baby_invites")
                .insert(NewInvite(baby_id: baby.id, email: email.lowercased().trimmingCharacters(in: .whitespaces), role: role, invited_by: userId))
                .execute()
            email = ""
            message = "Invite created — copy the link below and send it to them."
            Haptics.success()
            await load()
        } catch {
            message = "Couldn't create the invite."
        }
    }

    private func revoke(_ invite: BabyInvite) async {
        struct R: Encodable { let status: String }
        _ = try? await store.supabase.from("baby_invites")
            .update(R(status: "revoked"))
            .eq("id", value: invite.id)
            .execute()
        await load()
    }
}

// MARK: - Account

private struct AccountSection: View {
    @EnvironmentObject private var store: Store
    @Binding var appearance: String
    @State private var avatarItem: PhotosPickerItem?

    var body: some View {
        Section {
            HStack(spacing: 12) {
                if let profile = store.myProfile {
                    AvatarView(profile: profile)
                }
                PhotosPicker(selection: $avatarItem, matching: .images) {
                    Text("Change photo").font(.system(.subheadline, design: .rounded, weight: .semibold))
                }
            }
            .onChange(of: avatarItem) { _, item in
                guard let item else { return }
                Task {
                    if let data = try? await item.loadTransferable(type: Data.self),
                       let image = UIImage(data: data),
                       let jpeg = image.squareAvatarJPEG() {
                        try? await store.uploadAvatar(jpeg)
                    }
                    avatarItem = nil
                }
            }

            Toggle(isOn: Binding(
                get: { !(store.mySettings.appearOffline ?? false) },
                set: { visible in Task { await store.updateSetting(appearOffline: !visible) } }
            )) {
                Label("Show me as online to friends", systemImage: "circle.fill")
            }
            .tint(.accent)

            Toggle(isOn: Binding(
                get: { store.mySettings.readReceipts ?? true },
                set: { on in Task { await store.updateSetting(readReceipts: on) } }
            )) {
                Label("Read receipts", systemImage: "checkmark.message")
            }
            .tint(.accent)

            Picker(selection: $appearance) {
                Text("System").tag("system")
                Text("Light").tag("light")
                Text("Dark").tag("dark")
            } label: {
                Label("Appearance", systemImage: "circle.lefthalf.filled")
            }

            LabeledContent("Signed in as", value: store.session?.user.email ?? "—")

            LabeledContent("Membership") {
                Text(store.aiEnabled ? "Advanced" : "Free")
                    .font(.caption.weight(.bold))
                    .padding(.horizontal, 9)
                    .padding(.vertical, 3)
                    .background((store.aiEnabled ? Color.positive : Color.accent).opacity(0.15), in: .capsule)
                    .foregroundStyle(store.aiEnabled ? Color.positive : Color.accent)
            }

            Button(role: .destructive) {
                Task { await store.signOut() }
            } label: {
                Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
            }
        } header: {
            Text("Account")
        } footer: {
            Text(store.aiEnabled
                 ? "Advanced: everything in Free, plus Bea — questions, quick log, drafts and the evening digest."
                 : "Free covers tracking, charts, history and carer sharing. Advanced adds Bea — upgrades are coming soon.")
        }
        .listRowBackground(Color.surface)
    }
}

// MARK: - Data (exports, import)

private struct DataSection: View {
    @EnvironmentObject private var store: Store
    @State private var csv: String?
    @State private var showReport = false
    @State private var showHandover = false
    @State private var showImport = false
    @State private var removeConfirm = false
    @State private var removeResult: String?

    var body: some View {
        Section {
            Button {
                Task { csv = await store.csvExport() }
            } label: {
                Label("Download CSV", systemImage: "arrow.down.doc")
            }
            .sheet(item: Binding(
                get: { csv.map { CSVDoc(text: $0) } },
                set: { csv = $0?.text }
            )) { doc in
                ShareSheet(items: [doc.fileURL()])
            }

            Button {
                showReport = true
            } label: {
                Label("Printable report", systemImageName: "doc.text")
            }
            .sheet(isPresented: $showReport) {
                ReportSheet()
            }

            if store.aiEnabled {
                Button {
                    showHandover = true
                } label: {
                    Label("AI handover summary", systemImageName: "sparkles")
                }
                .sheet(isPresented: $showHandover) {
                    HandoverSheet()
                }
            }

            if store.canEdit {
                Button {
                    showImport = true
                } label: {
                    Label("Import from Huckleberry", systemImageName: "square.and.arrow.down")
                }
                .sheet(isPresented: $showImport) {
                    ImportSheet()
                }

                if removeConfirm {
                    Button("Remove all imported entries — sure?", role: .destructive) {
                        Task {
                            let n = (try? await store.removeImportedEntries()) ?? 0
                            removeResult = "Removed \(n) imported entries."
                            removeConfirm = false
                        }
                    }
                } else {
                    Button("Remove imported entries") { removeConfirm = true }
                        .foregroundStyle(Color.muted)
                }
                if let removeResult {
                    Text(removeResult).font(.caption).foregroundStyle(Color.positive)
                }
            }
        } header: {
            Text("Your data")
        } footer: {
            Text("Exports cover everything logged — handy for a midwife, health visitor or GP appointment.")
        }
        .listRowBackground(Color.surface)
    }
}

private struct CSVDoc: Identifiable {
    let text: String
    var id: Int { text.hashValue }

    func fileURL() -> URL {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("Beanlo-export.csv")
        try? text.data(using: .utf8)?.write(to: url)
        return url
    }
}

struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}

private extension Label where Title == Text, Icon == Image {
    init(_ title: String, systemImageName: String) {
        self.init(title, systemImage: systemImageName)
    }
}

// MARK: - Danger zone

private struct DangerSection: View {
    @EnvironmentObject private var store: Store
    @State private var confirmDeleteBaby = false
    @State private var confirmLeave = false
    @State private var confirmDeleteAccount = false
    @State private var error: String?

    var body: some View {
        Section {
            if store.isOwner, let baby = store.baby {
                if confirmDeleteBaby {
                    Button("Permanently delete \(baby.name) for every carer — sure?", role: .destructive) {
                        Task {
                            do { try await store.deleteBaby() } catch { self.error = error.localizedDescription }
                        }
                    }
                    Button("Keep \(baby.name)") { confirmDeleteBaby = false }
                        .foregroundStyle(Color.muted)
                } else {
                    Button("Delete \(baby.name)", role: .destructive) { confirmDeleteBaby = true }
                }
            } else if store.baby != nil {
                if confirmLeave {
                    Button("Leave \(store.baby!.name) — sure?", role: .destructive) {
                        Task {
                            do { try await store.leaveBaby() } catch { self.error = error.localizedDescription }
                        }
                    }
                    Button("Stay") { confirmLeave = false }
                        .foregroundStyle(Color.muted)
                } else {
                    Button("Leave \(store.baby!.name)", role: .destructive) { confirmLeave = true }
                }
            }

            if confirmDeleteAccount {
                Button("Delete your account and all owned data — sure?", role: .destructive) {
                    Task {
                        do { try await store.deleteAccount() } catch { self.error = error.localizedDescription }
                    }
                }
                Button("Keep my account") { confirmDeleteAccount = false }
                    .foregroundStyle(Color.muted)
            } else {
                Button("Delete your account", role: .destructive) { confirmDeleteAccount = true }
            }
            if let error {
                Text(error).font(.caption).foregroundStyle(Color.alertTone)
            }
        } header: {
            Text("Danger zone")
        } footer: {
            Text("Deleting a baby removes all their entries, notes and photos for every carer. Deleting your account also deletes any baby you own; babies shared with you just lose your access.\n\n\(Clinical.disclaimer)")
        }
        .listRowBackground(Color.surface)
    }
}

// MARK: - Baby profile (owner-editable, like the web's Baby tab)

private struct BabySection: View {
    @EnvironmentObject private var store: Store
    let baby: Baby
    let canEdit: Bool

    @State private var editingField: Field?

    enum Field: String, Identifiable {
        case name, birth, birthWeight, nappyWeight, interval, sex
        var id: String { rawValue }
    }

    var body: some View {
        Section {
            row("Name", baby.name, field: .name)
            row("Date & time of birth",
                baby.birthAt.formatted(.dateTime.weekday(.abbreviated).day().month().year().hour().minute()),
                field: .birth)
            row("Birth weight", String(format: "%.2f kg", Double(baby.birthWeightG) / 1000), field: .birthWeight)
            row("Dry nappy weight", baby.nappyBaseWeightG.map { "\($0) g" } ?? "not set", field: .nappyWeight)
            row("Time between feeds", baby.feedIntervalMin.map { "\($0 / 60) hours" } ?? "not set", field: .interval)
            row("Sex", baby.sex.map { $0 == "boy" ? "Boy" : "Girl" } ?? "not set", field: .sex)
        } header: {
            Text("Baby")
        } footer: {
            if !canEdit {
                Text("Only \(baby.name)'s owner can change these.")
            }
        }
        .listRowBackground(Color.surface)
        .sheet(item: $editingField) { field in
            BabyFieldEditor(baby: baby, field: field)
                .presentationDetents([.medium])
                .presentationBackground(Color.sand)
        }
    }

    @ViewBuilder
    private func row(_ label: String, _ value: String, field: Field) -> some View {
        if canEdit {
            Button {
                editingField = field
            } label: {
                HStack {
                    Text(label).foregroundStyle(Color.ink)
                    Spacer()
                    Text(value).foregroundStyle(Color.muted)
                    Image(systemName: "pencil").font(.caption).foregroundStyle(Color.faint)
                }
            }
        } else {
            LabeledContent(label, value: value)
        }
    }
}

/// One-field edit sheet, mirroring the web's inline pencil editors.
private struct BabyFieldEditor: View {
    @EnvironmentObject private var store: Store
    @Environment(\.dismiss) private var dismiss
    let baby: Baby
    let field: BabySection.Field

    @State private var text = ""
    @State private var date = Date()
    @State private var sexChoice = "boy"
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    switch field {
                    case .name:
                        TextField("Name", text: $text)
                    case .birth:
                        DatePicker("Born", selection: $date, in: ...Date(), displayedComponents: [.date, .hourAndMinute])
                    case .birthWeight:
                        HStack {
                            TextField("3.42", text: $text).keyboardType(.decimalPad).font(.stat(28))
                            Text("kg").foregroundStyle(Color.muted)
                        }
                    case .nappyWeight:
                        HStack {
                            TextField("19", text: $text).keyboardType(.numberPad).font(.stat(28))
                            Text("g").foregroundStyle(Color.muted)
                        }
                    case .interval:
                        Stepper(value: Binding(
                            get: { Int(text) ?? 3 },
                            set: { text = String($0) }
                        ), in: 1...6) {
                            Text("\(Int(text) ?? 3) hours")
                                .font(.system(.body, design: .rounded, weight: .semibold))
                        }
                    case .sex:
                        Picker("Sex", selection: $sexChoice) {
                            Text("Boy").tag("boy")
                            Text("Girl").tag("girl")
                        }
                        .pickerStyle(.segmented)
                    }
                } footer: {
                    if field == .sex {
                        Text("Used only to pick the right WHO growth chart.")
                    }
                    if let error {
                        Text(error).foregroundStyle(Color.alertTone)
                    }
                }
                .listRowBackground(Color.surface)
            }
            .scrollContentBackground(.hidden)
            .background(Color.sand)
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        Task { await save() }
                    } label: {
                        if busy { ProgressView() } else { Text("Save").bold() }
                    }
                }
            }
        }
        .onAppear { hydrate() }
    }

    private var title: String {
        switch field {
        case .name: "Name"
        case .birth: "Date of birth"
        case .birthWeight: "Birth weight"
        case .nappyWeight: "Dry nappy weight"
        case .interval: "Feed interval"
        case .sex: "Sex"
        }
    }

    private func hydrate() {
        switch field {
        case .name: text = baby.name
        case .birth: date = baby.birthAt
        case .birthWeight: text = String(format: "%.2f", Double(baby.birthWeightG) / 1000)
        case .nappyWeight: text = baby.nappyBaseWeightG.map(String.init) ?? ""
        case .interval: text = String((baby.feedIntervalMin ?? 180) / 60)
        case .sex: sexChoice = baby.sex ?? "boy"
        }
    }

    private func save() async {
        busy = true
        error = nil
        var changes = BabyUpdate()
        switch field {
        case .name:
            changes.name = text.trimmingCharacters(in: .whitespaces)
        case .birth:
            changes.birthAt = date
        case .birthWeight:
            guard let kg = Double(text.replacingOccurrences(of: ",", with: ".")) else {
                error = "Enter a weight in kg."
                busy = false
                return
            }
            changes.birthWeightG = Int(kg * 1000)
        case .nappyWeight:
            changes.nappyBaseWeightG = Int(text.trimmingCharacters(in: .whitespaces))
        case .interval:
            changes.feedIntervalMin = (Int(text) ?? 3) * 60
        case .sex:
            changes.sex = sexChoice
        }
        do {
            try await store.updateBaby(changes)
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
        busy = false
    }
}

// MARK: - What to track

private struct TrackingSection: View {
    @EnvironmentObject private var store: Store
    let baby: Baby
    let canEdit: Bool

    private let all: [EntryType] = [.nappy, .feed, .sleep, .weight, .pump, .carerSleep, .temperature, .milestone, .medication]

    var body: some View {
        Section {
            ForEach(all) { type in
                Toggle(isOn: binding(type)) {
                    Label(type.label, systemImage: type.symbol)
                }
                .tint(.accent)
                .disabled(!canEdit)
            }
        } header: {
            Text("What to track")
        } footer: {
            Text("Turned-off categories disappear from the + button and Today. Existing entries are kept.")
        }
        .listRowBackground(Color.surface)
    }

    private func binding(_ type: EntryType) -> Binding<Bool> {
        Binding(
            get: { (baby.trackedTypes ?? []).contains(type.rawValue) },
            set: { on in
                var tracked = Set(baby.trackedTypes ?? [])
                if on { tracked.insert(type.rawValue) } else { tracked.remove(type.rawValue) }
                guard !tracked.isEmpty else { return } // keep at least one
                var changes = BabyUpdate()
                changes.trackedTypes = Array(tracked)
                Task { try? await store.updateBaby(changes) }
            }
        )
    }
}

// MARK: - Carers

private struct CarersSection: View {
    @EnvironmentObject private var store: Store

    var body: some View {
        Section {
            ForEach(store.carers) { carer in
                HStack {
                    Image(systemName: "person.crop.circle.fill")
                        .foregroundStyle(Color.accent)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(carer.name ?? carer.email ?? "Carer")
                            .font(.system(.body, design: .rounded, weight: .medium))
                        if carer.name != nil, let email = carer.email {
                            Text(email).font(.caption).foregroundStyle(Color.muted)
                        }
                    }
                    Spacer()
                    Text(carer.role == "owner" ? "owner"
                         : carer.role == "viewer" ? "healthcare · read-only" : "caregiver")
                        .font(.caption)
                        .foregroundStyle(Color.muted)
                }
            }
        } header: {
            Text("Carers")
        } footer: {
            Text("Invite another carer or a healthcare professional from beanlo.com → Settings → Carers.")
        }
        .listRowBackground(Color.surface)
    }
}
