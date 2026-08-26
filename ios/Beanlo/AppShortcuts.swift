import AppIntents

/// Registers the quick-log intent with Siri, Spotlight, the Shortcuts app
/// and the Action Button. "Hey Siri, log a wet nappy in beanlo."
struct BeanloShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: LogNappyIntent(),
            phrases: [
                "Log a \(\.$kind) nappy in \(.applicationName)",
                "Log a nappy in \(.applicationName)",
                "\(.applicationName) nappy",
            ],
            shortTitle: "Log nappy",
            systemImageName: "drop.fill"
        )
    }
}
