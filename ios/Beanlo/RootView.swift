import SwiftUI

struct RootView: View {
    @EnvironmentObject private var store: Store
    @State private var logSheet: EntryType?
    @State private var editing: Entry?
    @State private var selectedTab = 0
    @State private var showSettings = false
    @State private var quickToast: QuickToast?
    @State private var quickToastDismiss: Task<Void, Never>?

    struct QuickToast {
        let message: String
        let undo: () async -> Void
    }

    private var ongoingSleep: Entry? {
        store.entries.first {
            $0.type == .sleep && $0.endedAt == nil
                && Date().timeIntervalSince($0.occurredAt) < 12 * 3600
        }
    }

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
            if store.feedTimer.isActive && logSheet == nil && editing == nil && !store.chatThreadOpen {
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
                    if store.canEdit {
                        // Instant actions — saved with no sheet, one tap.
                        if store.trackedTypes.contains(.nappy) {
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
                        if store.trackedTypes.contains(.feed), !store.feedTimer.isActive {
                            Button {
                                Haptics.tap()
                                store.toggleFeedTimer(.left)
                            } label: {
                                Label("Start feed timer — left", systemImage: "waterbottle.fill")
                            }
                            Button {
                                Haptics.tap()
                                store.toggleFeedTimer(.right)
                            } label: {
                                Label("Start feed timer — right", systemImage: "waterbottle.fill")
                            }
                        }
                        if store.trackedTypes.contains(.sleep) {
                            if let ongoing = ongoingSleep {
                                Button {
                                    quickEndSleep(ongoing)
                                } label: {
                                    Label("Woke up — end sleep (since \(ongoing.occurredAt.timeLabel))", systemImage: "sun.max.fill")
                                }
                            } else {
                                Button {
                                    quickStartSleep()
                                } label: {
                                    Label("Fell asleep — start sleep", systemImage: "moon.zzz.fill")
                                }
                            }
                        }
                        Divider()
                        // Everything the family tracks, one tap into its form.
                        ForEach(store.trackedTypes) { t in
                            Button {
                                Haptics.tap()
                                logSheet = t
                            } label: {
                                Label("Log \(t.label.lowercased())…", systemImage: t.symbol)
                            }
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
            if let toast = quickToast {
                HStack(spacing: 10) {
                    Text(toast.message)
                        .font(.system(.subheadline, design: .rounded, weight: .semibold))
                    Button("Undo") {
                        Haptics.tap()
                        let undo = toast.undo
                        quickToast = nil
                        Task { await undo() }
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

    private func showToast(_ message: String, undo: @escaping () async -> Void) {
        withAnimation(.snappy) { quickToast = QuickToast(message: message, undo: undo) }
        quickToastDismiss?.cancel()
        quickToastDismiss = Task {
            try? await Task.sleep(for: .seconds(5))
            if !Task.isCancelled {
                withAnimation(.snappy) { quickToast = nil }
            }
        }
    }

    private func quickLogNappy(dirty: Bool) {
        guard let baby = store.baby, let userId = store.userId else { return }
        Haptics.tap()
        var new = NewEntry(babyId: baby.id, type: .nappy, occurredAt: .now, createdBy: userId)
        new.dirty = dirty
        Task {
            guard let saved = try? await store.save(new) else { return }
            showToast("\(dirty ? "Mixed" : "Wet") nappy logged") {
                try? await store.delete(saved)
            }
        }
    }

    private func quickStartSleep() {
        guard let baby = store.baby, let userId = store.userId else { return }
        Haptics.tap()
        let new = NewEntry(babyId: baby.id, type: .sleep, occurredAt: .now, createdBy: userId)
        Task {
            guard let saved = try? await store.save(new) else { return }
            showToast("Sleep started") {
                try? await store.delete(saved)
            }
        }
    }

    private func quickEndSleep(_ entry: Entry) {
        Haptics.tap()
        Task {
            await store.setSleepEnd(entry, to: .now)
            showToast("Sleep ended — \(Self.durationLabel(from: entry.occurredAt))") {
                await store.setSleepEnd(entry, to: nil)
            }
        }
    }

    private static func durationLabel(from start: Date) -> String {
        let mins = Int(Date().timeIntervalSince(start) / 60)
        return mins >= 60 ? "\(mins / 60)h \(mins % 60)m" : "\(mins)m"
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
