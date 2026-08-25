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

    var body: some Scene {
        WindowGroup {
            Group {
                if store.session == nil {
                    AuthView()
                } else {
                    RootView()
                }
            }
            .environmentObject(store)
            .tint(.accent)
            .task {
                #if DEBUG
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
