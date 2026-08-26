import SwiftUI

struct RootView: View {
    @EnvironmentObject private var store: Store
    @State private var logSheet: EntryType?
    @State private var editing: Entry?
    @State private var selectedTab = 0
    @State private var showSettings = false
    @State private var quickLogged: Entry?
    @State private var quickToastDismiss: Task<Void, Never>?

    var body: some View {
        TabView(selection: $selectedTab) {
            // iPhone shows at most five tabs before collapsing into "More",
            // so Settings lives behind the gear on the Today header instead.
            Tab("Today", systemImage: "sun.max.fill", value: 0) {
                NavigationStack { TodayView(logSheet: $logSheet, showSettings: $showSettings) }
            }
            Tab("History", systemImage: "clock.fill", value: 1) {
                NavigationStack { HistoryView(editing: $editing) }
            }
            Tab("Charts", systemImage: "chart.bar.fill", value: 2) {
                NavigationStack { ChartsView() }
            }
            Tab("Notes", systemImage: "square.and.pencil", value: 3) {
                NavigationStack { NotesView() }
            }
            Tab("Friends", systemImage: "person.2.fill", value: 4) {
                NavigationStack { FriendsView() }
            }
            .badge(store.unreadDMs)
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
        // Floating glass log button, docked above the tab bar — hidden while
        // a friend chat is open so it doesn't cover the message input.
        // Tap opens the log sheet; long-press offers one-tap nappy logging
        // (only for types switched on in Settings).
        .overlay(alignment: .bottomTrailing) {
            if !store.chatThreadOpen {
                Menu {
                    if store.canEdit, store.trackedTypes.contains(.nappy) {
                        Button {
                            quickLogNappy(dirty: false)
                        } label: {
                            Label("Wet nappy — log now", systemImage: "drop.fill")
                        }
                        Button {
                            quickLogNappy(dirty: true)
                        } label: {
                            Label("Mixed nappy — log now", systemImage: "drop.circle.fill")
                        }
                    }
                } label: {
                    Image(systemName: "plus")
                        .font(.system(size: 22, weight: .semibold))
                        .foregroundStyle(Color.ink)
                        .frame(width: 58, height: 58)
                } primaryAction: {
                    Haptics.tap()
                    logSheet = store.trackedTypes.first ?? .nappy
                }
                .glassEffect(.regular.tint(Color.accent.opacity(0.5)).interactive(), in: .circle)
                .padding(.trailing, 20)
                .padding(.bottom, 84)
                .accessibilityLabel("Log an entry")
            }
        }
        // Undo toast for one-tap logs.
        .overlay(alignment: .bottom) {
            if let logged = quickLogged {
                HStack(spacing: 10) {
                    Text("\(logged.dirty == true ? "Mixed" : "Wet") nappy logged")
                        .font(.system(.subheadline, design: .rounded, weight: .semibold))
                    Button("Undo") {
                        Haptics.tap()
                        let entry = logged
                        quickLogged = nil
                        Task { try? await store.delete(entry) }
                    }
                    .font(.system(.subheadline, design: .rounded, weight: .bold))
                    .foregroundStyle(Color.accent)
                }
                .foregroundStyle(Color.ink)
                .padding(.horizontal, 18)
                .padding(.vertical, 12)
                .glassEffect(.regular, in: .capsule)
                .padding(.bottom, 152)
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .sheet(item: $logSheet) { initial in
            LogSheet(initialType: initial)
        }
        .sheet(isPresented: $showSettings) {
            NavigationStack {
                SettingsView()
                    .toolbar {
                        ToolbarItem(placement: .confirmationAction) {
                            Button("Done") { showSettings = false }
                        }
                    }
            }
        }
        #if DEBUG
        .onAppear {
            // Simulator test hook: `simctl launch … -DevTab charts|history|log`
            switch UserDefaults.standard.string(forKey: "DevTab") {
            case "history": selectedTab = 1
            case "charts": selectedTab = 2
            case "notes": selectedTab = 3
            case "friends": selectedTab = 4
            case "settings": showSettings = true
            case "log": logSheet = .nappy
            case "logfeed": logSheet = .feed
            default: break
            }
            if let side = UserDefaults.standard.string(forKey: "DevStartTimer") {
                store.toggleFeedTimer(side == "right" ? .right : .left)
            }
            // Exercises the widget/Siri quick-log path (REST + app-group
            // creds) without needing a tap on the widget.
            if UserDefaults.standard.bool(forKey: "DevQuickNappy") {
                Task { print("DevQuickNappy:", await QuickLogger.logNappy(dirty: false)) }
            }
        }
        #endif
        .sheet(item: $editing) { entry in
            LogSheet(initialType: entry.type, editing: entry)
        }
        .refreshable { await store.refresh() }
    }

    private func quickLogNappy(dirty: Bool) {
        guard let baby = store.baby, let userId = store.userId else { return }
        Haptics.tap()
        var new = NewEntry(babyId: baby.id, type: .nappy, occurredAt: .now, createdBy: userId)
        new.dirty = dirty
        Task {
            guard let saved = try? await store.save(new) else { return }
            withAnimation(.snappy) { quickLogged = saved }
            quickToastDismiss?.cancel()
            quickToastDismiss = Task {
                try? await Task.sleep(for: .seconds(5))
                if !Task.isCancelled {
                    withAnimation(.snappy) { quickLogged = nil }
                }
            }
        }
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
