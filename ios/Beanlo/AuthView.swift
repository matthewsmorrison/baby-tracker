import SwiftUI

/// Sign in with the same email account as the web app: we email the usual
/// sign-in link, and tapping it on this phone opens straight into the app.
struct AuthView: View {
    @EnvironmentObject private var store: Store
    @State private var email = ""
    @State private var linkSent = false
    @State private var busy = false
    @State private var error: String?
    @FocusState private var focused: Bool

    var body: some View {
        ZStack {
            SkyBackground()

            VStack(spacing: 28) {
                Spacer()

                VStack(spacing: 8) {
                    Image(systemName: "flame")
                        .font(.system(size: 44, weight: .medium))
                        .foregroundStyle(Color.accent)
                        .padding(22)
                        .glassEffect(.regular.interactive(), in: .circle)
                    Text("beanlo")
                        .font(.stat(40))
                        .foregroundStyle(Color.ink)
                    Text("the calm newborn tracker")
                        .font(.subheadline)
                        .foregroundStyle(Color.muted)
                }

                VStack(spacing: 14) {
                    if !linkSent {
                        TextField("Email", text: $email)
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .focused($focused)
                            .padding(16)
                            .glassEffect(.regular, in: .rect(cornerRadius: 18))

                        Button {
                            Task { await send() }
                        } label: {
                            Group {
                                if busy { ProgressView() } else { Text("Email me a sign-in link") }
                            }
                            .font(.system(.body, design: .rounded, weight: .semibold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 6)
                        }
                        .buttonStyle(.glassProminent)
                        .disabled(busy || !email.contains("@"))

                        HStack {
                            Rectangle().fill(Color.line).frame(height: 1)
                            Text("or").font(.caption).foregroundStyle(Color.faint)
                            Rectangle().fill(Color.line).frame(height: 1)
                        }
                        .padding(.vertical, 2)

                        Button {
                            Task { await google() }
                        } label: {
                            HStack(spacing: 8) {
                                Image(systemName: "g.circle.fill").font(.title3)
                                Text("Continue with Google")
                            }
                            .font(.system(.body, design: .rounded, weight: .semibold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 6)
                        }
                        .buttonStyle(.glass)
                        .disabled(busy)
                    } else {
                        VStack(spacing: 10) {
                            Image(systemName: "envelope.badge.fill")
                                .font(.largeTitle)
                                .foregroundStyle(Color.accent)
                            Text("Check your email on this phone")
                                .font(.system(.headline, design: .rounded))
                                .foregroundStyle(Color.ink)
                            Text("We sent a sign-in link to \(email).\nTapping it opens beanlo, signed in.")
                                .font(.subheadline)
                                .foregroundStyle(Color.muted)
                                .multilineTextAlignment(.center)
                        }
                        .padding(22)
                        .glassEffect(.regular, in: .rect(cornerRadius: 24))

                        Button("Use a different email") {
                            linkSent = false
                        }
                        .font(.footnote)
                        .foregroundStyle(Color.muted)
                    }

                    if let error {
                        Text(error)
                            .font(.footnote)
                            .foregroundStyle(Color.alertTone)
                            .multilineTextAlignment(.center)
                    }
                    if let storeError = store.errorMessage, linkSent {
                        Text(storeError)
                            .font(.footnote)
                            .foregroundStyle(Color.alertTone)
                            .multilineTextAlignment(.center)
                    }
                }
                .padding(.horizontal, 28)

                Spacer()
                Spacer()
            }
        }
        .onAppear { focused = true }
    }

    private func google() async {
        busy = true
        error = nil
        do {
            try await store.signInWithGoogle()
            Haptics.success()
        } catch {
            // Cancelling the Google sheet lands here too — stay quiet then.
            if !error.localizedDescription.localizedCaseInsensitiveContains("cancel") {
                self.error = "Google sign-in didn't complete — try again."
            }
        }
        busy = false
    }

    private func send() async {
        busy = true
        error = nil
        do {
            try await store.sendMagicLink(email: email.trimmingCharacters(in: .whitespaces))
            linkSent = true
            Haptics.success()
        } catch {
            self.error = "Couldn't send the link — check the email address (it must already have a beanlo account)."
        }
        busy = false
    }
}

/// Time-of-day aware warm sky, echoing the web app's hero.
struct SkyBackground: View {
    var body: some View {
        let hour = Calendar.current.component(.hour, from: .now)
        let night = hour >= 21 || hour < 6
        let evening = hour >= 17 && hour < 21

        LinearGradient(
            colors: night
                ? [Color(light: 0x2B2438, dark: 0x0E0C14), .sand]
                : evening
                    ? [Color(light: 0xF3CFA0, dark: 0x2B2418), .sand]
                    : [.sandGlow, .sand],
            startPoint: .top,
            endPoint: .center
        )
        .overlay(alignment: .topTrailing) {
            Circle()
                .fill(night ? Color(light: 0xEFEAF7, dark: 0xD8D2C4) : .accent)
                .frame(width: 46, height: 46)
                .blur(radius: 1)
                .shadow(color: (night ? Color.white : Color.accent).opacity(0.55), radius: 34)
                .padding(.top, 70)
                .padding(.trailing, 60)
        }
        .ignoresSafeArea()
    }
}
