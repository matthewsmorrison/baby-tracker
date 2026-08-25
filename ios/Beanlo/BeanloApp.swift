import SwiftUI
import UIKit

/// Receives the APNs device token; everything else stays in SwiftUI.
final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        let hex = deviceToken.map { String(format: "%02x", $0) }.joined()
        Task { await Store.shared.uploadPushToken(hex) }
    }
}

@main
struct BeanloApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var store = Store.shared
    @Environment(\.scenePhase) private var scenePhase
    @AppStorage("appearance") private var appearance = "system"

    var body: some Scene {
        WindowGroup {
            Group {
                if store.session == nil {
                    AuthView()
                } else if store.memberships.isEmpty && !store.loading && store.baby == nil {
                    OnboardingView()
                } else {
                    RootView()
                }
            }
            .environmentObject(store)
            .tint(.accent)
            .preferredColorScheme(appearance == "dark" ? .dark : appearance == "light" ? .light : nil)
            .task {
                #if DEBUG
                assert(WHOWeight.verify(), "WHO tables diverge from the web implementation")
                await store.adoptDevSessionIfPresent()
                #endif
                // Refresh the APNs token on each launch (tokens can rotate).
                if store.pushEnabled {
                    UIApplication.shared.registerForRemoteNotifications()
                }
                await store.listenToAuth()
            }
            .onOpenURL { url in
                Task { await store.handleDeepLink(url) }
            }
            .onChange(of: scenePhase) { _, phase in
                // Reopening the app pulls whatever the other carer logged.
                if phase == .active, store.session != nil {
                    Task { await store.refresh() }
                }
            }
        }
    }
}
