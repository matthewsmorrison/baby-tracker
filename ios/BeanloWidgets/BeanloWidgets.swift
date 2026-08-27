import WidgetKit
import SwiftUI
import ActivityKit

@main
struct BeanloWidgetBundle: WidgetBundle {
    var body: some Widget {
        TodayWidget()
        FeedTimerLiveActivity()
    }
}

// MARK: - Feed timer Live Activity (lock screen + Dynamic Island)

struct FeedTimerLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: FeedTimerAttributes.self) { context in
            // Lock screen banner
            HStack(spacing: 14) {
                Image(systemName: "waterbottle.fill")
                    .font(.title2)
                    .foregroundStyle(Color.accent)
                    .frame(width: 46, height: 46)
                    .background(Color.accentSoft, in: .circle)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Feeding \(context.attributes.babyName)")
                        .font(.system(.subheadline, design: .rounded, weight: .bold))
                    Text(context.state.running ? "\(context.state.sideLabel) side" : "Paused")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                timerText(context.state, size: 34)
                    .foregroundStyle(Color.accent)
            }
            .padding(16)
            .activityBackgroundTint(Color.sand.opacity(0.85))
            .activitySystemActionForegroundColor(Color.ink)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 8) {
                        Image(systemName: "waterbottle.fill")
                            .foregroundStyle(Color.accent)
                        Text(context.state.running ? context.state.sideLabel : "Paused")
                            .font(.system(.subheadline, design: .rounded, weight: .semibold))
                    }
                    .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    timerText(context.state, size: 28)
                        .foregroundStyle(Color.accent)
                        .padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text("Feeding \(context.attributes.babyName) — open Beanlo to switch sides or save")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            } compactLeading: {
                Image(systemName: "waterbottle.fill")
                    .foregroundStyle(Color.accent)
            } compactTrailing: {
                timerText(context.state, size: 14)
                    .frame(maxWidth: 52)
                    .foregroundStyle(Color.accent)
            } minimal: {
                Image(systemName: "waterbottle.fill")
                    .foregroundStyle(Color.accent)
            }
        }
    }

    @ViewBuilder
    private func timerText(_ state: FeedTimerAttributes.ContentState, size: CGFloat) -> some View {
        if state.running {
            Text(timerInterval: state.startReference...state.startReference.addingTimeInterval(12 * 3600),
                 countsDown: false)
                .font(.stat(size))
                .monospacedDigit()
                .multilineTextAlignment(.trailing)
        } else {
            Text(staticLabel(state.totalSeconds))
                .font(.stat(size))
                .monospacedDigit()
        }
    }

    private func staticLabel(_ seconds: Int) -> String {
        String(format: "%d:%02d", seconds / 60, seconds % 60)
    }
}

// MARK: - Today widget (home + lock screen)

struct TodayEntry: TimelineEntry {
    var date: Date
    var snapshot: TodaySnapshot?
    // One-tap logging only appears when the app has mirrored a session and
    // nappy tracking is on in Settings.
    var canQuickLog = false
    var feedTimer = FeedTimerState()
    // "✓ Wet nappy logged" for ~45s after a widget tap (no haptics in
    // widget processes — this is the feedback).
    var confirmText: String?
}

struct TodayProvider: TimelineProvider {
    func placeholder(in context: Context) -> TodayEntry {
        TodayEntry(date: .now, snapshot: TodaySnapshot(
            babyName: "Beanlo", dayOfLife: 12, lastFeedAt: .now.addingTimeInterval(-4980),
            feedIntervalMin: 180, nappyCount: 5, nappyTarget: 8, updatedAt: .now
        ), canQuickLog: true)
    }

    func getSnapshot(in context: Context, completion: @escaping (TodayEntry) -> Void) {
        completion(TodayEntry(
            date: .now,
            snapshot: TodaySnapshot.load() ?? placeholder(in: context).snapshot,
            canQuickLog: QuickCreds.load()?.trackedNappy ?? false,
            feedTimer: FeedTimerState.loadShared()
        ))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TodayEntry>) -> Void) {
        let confirm = QuickConfirm.load()
        var entry = TodayEntry(
            date: .now,
            snapshot: TodaySnapshot.load(),
            canQuickLog: QuickCreds.load()?.trackedNappy ?? false,
            feedTimer: FeedTimerState.loadShared()
        )
        entry.confirmText = confirm?.text
        var entries = [entry]
        if let confirm {
            // A second entry clears the confirmation once its time is up.
            var cleared = entry
            cleared.confirmText = nil
            cleared.date = confirm.at.addingTimeInterval(QuickConfirm.showFor)
            entries.append(cleared)
        }
        completion(Timeline(entries: entries, policy: .after(.now.addingTimeInterval(15 * 60))))
    }
}

struct TodayWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "TodayWidget", provider: TodayProvider()) { entry in
            TodayWidgetView(entry: entry)
        }
        .configurationDisplayName("Beanlo")
        .description("Time since the last feed and today's nappy count.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryCircular])
    }
}

struct TodayWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: TodayEntry

    var body: some View {
        Group {
            switch family {
            case .accessoryCircular: circular
            case .accessoryRectangular: rectangular
            case .systemMedium: medium
            default: small
            }
        }
        .containerBackground(for: .widget) { Color.sand }
    }

    // Lock screen ring: feed-interval progress — or nappy progress when
    // feed tracking is switched off in Settings.
    @ViewBuilder
    private var circular: some View {
        if entry.snapshot?.showsFeeds ?? true {
            Gauge(value: intervalProgress) {
                Image(systemName: "waterbottle.fill")
            } currentValueLabel: {
                if let last = entry.snapshot?.lastFeedAt {
                    Text(last, style: .timer)
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .monospacedDigit()
                } else {
                    Text("—")
                }
            }
            .gaugeStyle(.accessoryCircular)
        } else {
            Gauge(value: nappyProgress) {
                Image(systemName: "drop.fill")
            } currentValueLabel: {
                Text("\(entry.snapshot?.nappyCount ?? 0)")
                    .font(.system(size: 14, weight: .bold, design: .rounded))
            }
            .gaugeStyle(.accessoryCircular)
        }
    }

    private var rectangular: some View {
        VStack(alignment: .leading, spacing: 2) {
            if let snap = entry.snapshot {
                if snap.showsFeeds {
                    HStack(spacing: 4) {
                        Image(systemName: "waterbottle.fill").font(.caption2)
                        if let last = snap.lastFeedAt {
                            Text("Fed ") + Text(last, style: .relative).fontWeight(.bold) + Text(" ago")
                        } else {
                            Text("No feeds yet")
                        }
                    }
                    .font(.system(.caption, design: .rounded))
                }
                if snap.showsNappies {
                    HStack(spacing: 4) {
                        Image(systemName: "drop.fill").font(.caption2)
                        Text("\(snap.nappyCount) of \(snap.nappyTarget) nappies")
                    }
                    .font(.system(.caption, design: .rounded))
                    .foregroundStyle(snap.showsFeeds ? .secondary : .primary)
                }
            } else {
                Text("Open Beanlo to start")
                    .font(.system(.caption, design: .rounded))
            }
        }
    }

    // Roomier layout: counts on the left, one-tap logging on the right.
    private var medium: some View {
        HStack(spacing: 14) {
            VStack(alignment: .leading, spacing: 6) {
                if let snap = entry.snapshot {
                    HStack {
                        Text(snap.babyName)
                            .font(.system(.subheadline, design: .rounded, weight: .bold))
                            .foregroundStyle(Color.ink)
                        Text("D\(snap.dayOfLife)")
                            .font(.system(.caption2, design: .rounded, weight: .bold))
                            .padding(.horizontal, 7)
                            .padding(.vertical, 3)
                            .background(Color.accentSoft, in: .capsule)
                            .foregroundStyle(Color.accent)
                    }
                    Spacer()
                    if snap.showsFeeds, entry.feedTimer.isActive {
                        timerStat(size: 24)
                    } else if snap.showsFeeds {
                        Text("Last feed")
                            .font(.caption2)
                            .foregroundStyle(Color.muted)
                        if let last = snap.lastFeedAt {
                            Text(last, style: .relative)
                                .font(.stat(24))
                                .foregroundStyle(Color.ink)
                                .minimumScaleFactor(0.6)
                                .lineLimit(1)
                        } else {
                            Text("—").font(.stat(24)).foregroundStyle(Color.muted)
                        }
                    }
                    if snap.showsNappies {
                        HStack(spacing: 3) {
                            ForEach(0..<max(snap.nappyTarget, snap.nappyCount), id: \.self) { i in
                                Capsule()
                                    .fill(i < snap.nappyCount ? Color.chartBlue : Color.line)
                                    .frame(height: 5)
                            }
                        }
                        Text("\(snap.nappyCount) of \(snap.nappyTarget) nappies")
                            .font(.system(.caption2, design: .rounded))
                            .foregroundStyle(Color.muted)
                    }
                } else {
                    Text("Open Beanlo to start")
                        .font(.system(.caption, design: .rounded))
                        .foregroundStyle(Color.muted)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if entry.canQuickLog || (entry.snapshot?.showsFeeds ?? false) {
                VStack(spacing: 7) {
                    if let confirm = entry.confirmText {
                        confirmRow(confirm)
                    }
                    if entry.snapshot?.showsFeeds ?? false {
                        HStack(spacing: 6) {
                            feedButton(.left, compact: false)
                            feedButton(.right, compact: false)
                        }
                    }
                    if entry.canQuickLog, entry.confirmText == nil {
                        quickButton(kind: .wet, label: "Wet", tint: Color.chartBlue)
                        quickButton(kind: .mixed, label: "Mixed", tint: Color.chartBrown)
                    }
                }
                .frame(width: 96)
            }
        }
    }

    /// Unmistakable post-tap feedback where the buttons were.
    private func confirmRow(_ text: String) -> some View {
        HStack(spacing: 4) {
            Image(systemName: "checkmark.circle.fill").font(.system(size: 10))
            Text(text)
                .lineLimit(2)
                .minimumScaleFactor(0.7)
        }
        .font(.system(.caption2, design: .rounded, weight: .bold))
        .frame(maxWidth: .infinity)
        .padding(.vertical, 6)
        .padding(.horizontal, 4)
        .background(Color.positive.opacity(0.18), in: .rect(cornerRadius: 10))
        .foregroundStyle(Color.positive)
    }

    private var small: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let snap = entry.snapshot {
                HStack {
                    Text(snap.babyName)
                        .font(.system(.footnote, design: .rounded, weight: .bold))
                        .foregroundStyle(Color.ink)
                    Spacer()
                    Text("D\(snap.dayOfLife)")
                        .font(.system(.caption2, design: .rounded, weight: .bold))
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(Color.accentSoft, in: .capsule)
                        .foregroundStyle(Color.accent)
                }
                Spacer()
                if snap.showsFeeds, entry.feedTimer.isActive {
                    timerStat(size: 22)
                } else if snap.showsFeeds, let last = snap.lastFeedAt {
                    Text("Last feed")
                        .font(.caption2)
                        .foregroundStyle(Color.muted)
                    Text(last, style: .relative)
                        .font(.stat(22))
                        .foregroundStyle(Color.ink)
                        .minimumScaleFactor(0.6)
                        .lineLimit(1)
                } else if !snap.showsFeeds, snap.showsNappies {
                    // Feeds untracked — nappies become the hero stat.
                    Text("Nappies today")
                        .font(.caption2)
                        .foregroundStyle(Color.muted)
                    Text("\(snap.nappyCount) of \(snap.nappyTarget)")
                        .font(.stat(22))
                        .foregroundStyle(Color.ink)
                }
                if snap.showsNappies {
                    HStack(spacing: 3) {
                        ForEach(0..<max(snap.nappyTarget, snap.nappyCount), id: \.self) { i in
                            Capsule()
                                .fill(i < snap.nappyCount ? Color.chartBlue : Color.line)
                                .frame(height: 5)
                        }
                    }
                }
                if let confirm = entry.confirmText {
                    confirmRow(confirm)
                } else {
                    HStack(spacing: 5) {
                        if snap.showsFeeds {
                            feedButton(.left, compact: true)
                            feedButton(.right, compact: true)
                        }
                        if entry.canQuickLog {
                            quickButton(kind: .wet, label: "Wet", tint: Color.chartBlue)
                            quickButton(kind: .mixed, label: "Mix", tint: Color.chartBrown)
                        }
                    }
                }
            } else {
                Image(systemName: "flame")
                    .font(.title2)
                    .foregroundStyle(Color.accent)
                Text("Open Beanlo to start")
                    .font(.system(.caption, design: .rounded))
                    .foregroundStyle(Color.muted)
            }
        }
    }

    /// Start/pause the feed timer for one side without opening the app.
    /// The running side pulses solid; the app raises the Live Activity when
    /// it next comes to the foreground.
    private func feedButton(_ side: FeedSideChoice, compact: Bool) -> some View {
        let running = entry.feedTimer.isRunning && entry.feedTimer.side == side.side
        return Button(intent: StartFeedTimerIntent(side: side)) {
            HStack(spacing: 4) {
                Image(systemName: running ? "pause.fill" : "waterbottle.fill")
                    .font(.system(size: 9))
                Text(compact ? (side == .left ? "L" : "R") : side.side.label)
            }
            .font(.system(.caption2, design: .rounded, weight: .bold))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)
            .background(running ? Color.accent : Color.accent.opacity(0.18), in: .capsule)
            .foregroundStyle(running ? Color.onInk : Color.accent)
        }
        .buttonStyle(.plain)
    }

    /// The hero stat while a feed is being timed: self-ticking when running,
    /// frozen total when paused.
    @ViewBuilder
    private func timerStat(size: CGFloat) -> some View {
        let t = entry.feedTimer
        Text(t.isRunning ? "Feeding — \(t.side?.label ?? "")" : "Feed paused")
            .font(.caption2)
            .foregroundStyle(t.isRunning ? Color.accent : Color.muted)
        if t.isRunning {
            let elapsed = t.total(.left, at: entry.date) + t.total(.right, at: entry.date)
            let reference = entry.date.addingTimeInterval(-elapsed)
            Text(timerInterval: reference...reference.addingTimeInterval(12 * 3600), countsDown: false)
                .font(.stat(size))
                .monospacedDigit()
                .foregroundStyle(Color.ink)
                .minimumScaleFactor(0.6)
                .lineLimit(1)
        } else {
            let secs = Int(t.grandTotal)
            Text(String(format: "%d:%02d", secs / 60, secs % 60))
                .font(.stat(size))
                .monospacedDigit()
                .foregroundStyle(Color.ink)
        }
    }

    /// One-tap logging straight from the home screen — no app launch.
    private func quickButton(kind: NappyKind, label: String, tint: Color) -> some View {
        Button(intent: LogNappyIntent(kind: kind)) {
            HStack(spacing: 4) {
                Image(systemName: "drop.fill").font(.system(size: 9))
                Text(label)
            }
            .font(.system(.caption2, design: .rounded, weight: .bold))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)
            .background(tint.opacity(0.18), in: .capsule)
            .foregroundStyle(tint)
        }
        .buttonStyle(.plain)
    }

    private var intervalProgress: Double {
        guard let snap = entry.snapshot, let last = snap.lastFeedAt,
              let interval = snap.feedIntervalMin, interval > 0 else { return 0 }
        return min(1, max(0, Date().timeIntervalSince(last) / Double(interval * 60)))
    }

    private var nappyProgress: Double {
        guard let snap = entry.snapshot, snap.nappyTarget > 0 else { return 0 }
        return min(1, Double(snap.nappyCount) / Double(snap.nappyTarget))
    }
}
