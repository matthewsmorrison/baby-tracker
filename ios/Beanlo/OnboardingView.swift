import SwiftUI

/// First run with no baby yet — create one (same fields as the web's
/// onboarding; the DB trigger makes the creator the owner).
struct OnboardingView: View {
    @EnvironmentObject private var store: Store
    @State private var name = ""
    @State private var birthAt = Calendar.current.date(byAdding: .day, value: -5, to: .now) ?? .now
    @State private var weightKgText = ""
    @State private var sex: String?
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        ZStack {
            SkyBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Welcome to Beanlo")
                            .font(.stat(30))
                            .foregroundStyle(Color.ink)
                        Text("Tell us about your baby — everything can be changed later in Settings.")
                            .font(.subheadline)
                            .foregroundStyle(Color.muted)
                    }
                    .padding(.top, 40)

                    Card {
                        VStack(alignment: .leading, spacing: 14) {
                            CardTitle("Baby's name")
                            TextField("Name", text: $name)
                                .font(.system(.body, design: .rounded))

                            CardTitle("Date & time of birth")
                            DatePicker("Born", selection: $birthAt, in: ...Date(), displayedComponents: [.date, .hourAndMinute])
                                .labelsHidden()

                            CardTitle("Birth weight")
                            HStack {
                                TextField("3.42", text: $weightKgText)
                                    .keyboardType(.decimalPad)
                                    .font(.stat(28))
                                Text("kg").foregroundStyle(Color.muted)
                            }

                            CardTitle("Sex — used for the WHO growth centiles")
                            HStack(spacing: 8) {
                                Chip(label: "Boy", active: sex == "boy") { sex = "boy" }
                                Chip(label: "Girl", active: sex == "girl") { sex = "girl" }
                            }
                        }
                    }

                    Button {
                        Task { await create() }
                    } label: {
                        Group {
                            if busy { ProgressView() } else { Text("Start tracking") }
                        }
                        .font(.system(.body, design: .rounded, weight: .semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                    }
                    .buttonStyle(.glassProminent)
                    .disabled(busy || name.trimmingCharacters(in: .whitespaces).isEmpty
                              || Double(weightKgText.replacingOccurrences(of: ",", with: ".")) == nil)

                    if let error {
                        Text(error).font(.footnote).foregroundStyle(Color.alertTone)
                    }

                    Button("Sign out") {
                        Task { await store.signOut() }
                    }
                    .font(.footnote)
                    .foregroundStyle(Color.muted)
                    .frame(maxWidth: .infinity)
                }
                .padding(20)
            }
        }
    }

    private func create() async {
        guard let userId = store.userId,
              let kg = Double(weightKgText.replacingOccurrences(of: ",", with: ".")) else { return }
        busy = true
        error = nil
        struct NewBaby: Encodable {
            let name: String
            let birth_at: String
            let birth_weight_g: Int
            let sex: String?
            let created_by: UUID
        }
        do {
            _ = try await store.supabase.from("babies").insert(NewBaby(
                name: name.trimmingCharacters(in: .whitespaces),
                birth_at: birthAt.ISO8601Format(),
                birth_weight_g: Int(kg * 1000),
                sex: sex,
                created_by: userId
            )).execute()
            await store.refresh()
            Haptics.success()
        } catch {
            self.error = "Couldn't create the baby — check the details and try again."
        }
        busy = false
    }
}
