import SwiftUI

@main
struct BeanloApp: App {
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
