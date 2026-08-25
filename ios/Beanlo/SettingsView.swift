import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var store: Store

    var body: some View {
        List {
            if let baby = store.baby {
                BabySection(baby: baby, canEdit: store.isOwner)
                TrackingSection(baby: baby, canEdit: store.isOwner)
                CarersSection()
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

            Section {
                LabeledContent("Signed in as", value: store.session?.user.email ?? "—")
                Link(destination: URL(string: "https://beanlo.com/profile")!) {
                    Label("Invites, exports & Bea on beanlo.com", systemImage: "safari")
                }
                Button(role: .destructive) {
                    Task { await store.signOut() }
                } label: {
                    Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
                }
            } header: {
                Text("Account")
            } footer: {
                Text("Everything you log here appears on the web instantly, and vice versa.\n\n\(Clinical.disclaimer)")
            }
            .listRowBackground(Color.surface)
        }
        .scrollContentBackground(.hidden)
        .background(Color.sand)
        .navigationTitle("Settings")
        .task { await store.loadCarers() }
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
