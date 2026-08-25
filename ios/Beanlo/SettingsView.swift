import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var store: Store

    var body: some View {
        List {
            if let baby = store.baby {
                Section("Baby") {
                    LabeledContent("Name", value: baby.name)
                    LabeledContent("Born", value: baby.birthAt.formatted(.dateTime.weekday(.abbreviated).day().month(.wide).year()))
                    LabeledContent("Birth weight", value: String(format: "%.2f kg", Double(baby.birthWeightG) / 1000))
                    if let interval = baby.feedIntervalMin {
                        LabeledContent("Feed interval", value: "\(interval / 60) hours")
                    }
                }
                .listRowBackground(Color.surface)
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
                    Label("Full settings on beanlo.com", systemImage: "safari")
                }
                Button(role: .destructive) {
                    Task { await store.signOut() }
                } label: {
                    Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
                }
            } header: {
                Text("Account")
            } footer: {
                Text("Baby settings, carers, exports and Bea live on the web app for now — everything you log here appears there instantly, and vice versa.\n\n\(Clinical.disclaimer)")
            }
            .listRowBackground(Color.surface)
        }
        .scrollContentBackground(.hidden)
        .background(Color.sand)
        .navigationTitle("Settings")
    }
}
