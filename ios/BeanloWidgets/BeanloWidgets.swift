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
                    Text("Feeding \(context.attributes.babyName) — open beanlo to switch sides or save")
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
    let date: Date
    let snapshot: TodaySnapshot?
}

struct TodayProvider: TimelineProvider {
    func placeholder(in context: Context) -> TodayEntry {
        TodayEntry(date: .now, snapshot: TodaySnapshot(
            babyName: "beanlo", dayOfLife: 12, lastFeedAt: .now.addingTimeInterval(-4980),
            feedIntervalMin: 180, nappyCount: 5, nappyTarget: 8, updatedAt: .now
        ))
    }

    func getSnapshot(in context: Context, completion: @escaping (TodayEntry) -> Void) {
        completion(TodayEntry(date: .now, snapshot: TodaySnapshot.load() ?? placeholder(in: context).snapshot))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TodayEntry>) -> Void) {
        let entry = TodayEntry(date: .now, snapshot: TodaySnapshot.load())
        completion(Timeline(entries: [entry], policy: .after(.now.addingTimeInterval(15 * 60))))
    }
}

struct TodayWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "TodayWidget", provider: TodayProvider()) { entry in
            TodayWidgetView(entry: entry)
        }
        .configurationDisplayName("beanlo")
        .description("Time since the last feed and today's nappy count.")
        .supportedFamilies([.systemSmall, .accessoryRectangular, .accessoryCircular])
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
            default: small
            }
        }
        .containerBackground(for: .widget) { Color.sand }
    }

    // Lock screen ring: how far through the feed interval we are.
    private var circular: some View {
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
    }

    private var rectangular: some View {
        VStack(alignment: .leading, spacing: 2) {
            if let snap = entry.snapshot {
                HStack(spacing: 4) {
                    Image(systemName: "waterbottle.fill").font(.caption2)
                    if let last = snap.lastFeedAt {
                        Text("Fed ") + Text(last, style: .relative).fontWeight(.bold) + Text(" ago")
                    } else {
                        Text("No feeds yet")
                    }
                }
                .font(.system(.caption, design: .rounded))
                HStack(spacing: 4) {
                    Image(systemName: "drop.fill").font(.caption2)
                    Text("\(snap.nappyCount) of \(snap.nappyTarget) nappies")
                }
                .font(.system(.caption, design: .rounded))
                .foregroundStyle(.secondary)
            } else {
                Text("Open beanlo to start")
                    .font(.system(.caption, design: .rounded))
            }
        }
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
                if let last = snap.lastFeedAt {
                    Text("Last feed")
                        .font(.caption2)
                        .foregroundStyle(Color.muted)
                    Text(last, style: .relative)
                        .font(.stat(22))
                        .foregroundStyle(Color.ink)
                        .minimumScaleFactor(0.6)
                        .lineLimit(1)
                }
                HStack(spacing: 3) {
                    ForEach(0..<max(snap.nappyTarget, snap.nappyCount), id: \.self) { i in
                        Capsule()
                            .fill(i < snap.nappyCount ? Color.chartBlue : Color.line)
                            .frame(height: 5)
                    }
                }
            } else {
                Image(systemName: "flame")
                    .font(.title2)
                    .foregroundStyle(Color.accent)
                Text("Open beanlo to start")
                    .font(.system(.caption, design: .rounded))
                    .foregroundStyle(Color.muted)
            }
        }
    }

    private var intervalProgress: Double {
        guard let snap = entry.snapshot, let last = snap.lastFeedAt,
              let interval = snap.feedIntervalMin, interval > 0 else { return 0 }
        return min(1, max(0, Date().timeIntervalSince(last) / Double(interval * 60)))
    }
}
