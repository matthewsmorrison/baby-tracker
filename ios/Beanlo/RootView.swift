import SwiftUI

struct RootView: View {
    @EnvironmentObject private var store: Store
    @State private var logSheet: EntryType?
    @State private var editing: Entry?
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            Tab("Today", systemImage: "sun.max.fill", value: 0) {
                NavigationStack { TodayView(logSheet: $logSheet) }
            }
            Tab("History", systemImage: "clock.fill", value: 1) {
                NavigationStack { HistoryView(editing: $editing) }
            }
            Tab("Charts", systemImage: "chart.bar.fill", value: 2) {
                NavigationStack { ChartsView() }
            }
            Tab("Settings", systemImage: "gearshape.fill", value: 3) {
                NavigationStack { SettingsView() }
            }
        }
        // Feed-timer pill: the timer keeps running when the sheet closes —
        // this makes that visible and gives a one-tap way back.
        .overlay(alignment: .bottom) {
            if store.feedTimer.isActive && logSheet == nil && editing == nil {
                TimerPill {
                    Haptics.tap()
                    logSheet = .feed
                }
                .padding(.bottom, 96)
            }
        }
        // Floating glass log button, docked above the tab bar.
        .overlay(alignment: .bottomTrailing) {
            Button {
                Haptics.tap()
                logSheet = store.trackedTypes.first ?? .nappy
            } label: {
                Image(systemName: "plus")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(Color.ink)
                    .frame(width: 58, height: 58)
            }
            .glassEffect(.regular.tint(Color.accent.opacity(0.5)).interactive(), in: .circle)
            .padding(.trailing, 20)
            .padding(.bottom, 84)
            .accessibilityLabel("Log an entry")
        }
        .sheet(item: $logSheet) { initial in
            LogSheet(initialType: initial)
        }
        #if DEBUG
        .onAppear {
            // Simulator test hook: `simctl launch … -DevTab charts|history|log`
            switch UserDefaults.standard.string(forKey: "DevTab") {
            case "history": selectedTab = 1
            case "charts": selectedTab = 2
            case "settings": selectedTab = 3
            case "log": logSheet = .nappy
            case "logfeed": logSheet = .feed
            default: break
            }
            if let side = UserDefaults.standard.string(forKey: "DevStartTimer") {
                store.toggleFeedTimer(side == "right" ? .right : .left)
            }
        }
        #endif
        .sheet(item: $editing) { entry in
            LogSheet(initialType: entry.type, editing: entry)
        }
        .refreshable { await store.refresh() }
    }
}

struct TimerPill: View {
    @EnvironmentObject private var store: Store
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Circle()
                    .fill(Color.accent)
                    .frame(width: 9, height: 9)
                Text("Feed timing ·")
                    .font(.system(.subheadline, design: .rounded, weight: .semibold))
                TimelineView(.periodic(from: .now, by: 1)) { context in
                    let secs = Int(store.feedTimer.total(.left, at: context.date) + store.feedTimer.total(.right, at: context.date))
                    Text(String(format: "%d:%02d", secs / 60, secs % 60))
                        .font(.stat(16))
                        .monospacedDigit()
                }
                Text("tap to return")
                    .font(.caption)
                    .opacity(0.65)
            }
            .foregroundStyle(Color.ink)
            .padding(.horizontal, 18)
            .padding(.vertical, 12)
        }
        .glassEffect(.regular.tint(Color.accent.opacity(0.35)).interactive(), in: .capsule)
    }
}
