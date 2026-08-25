import SwiftUI

struct TodayView: View {
    @EnvironmentObject private var store: Store
    @Binding var logSheet: EntryType?
    @State private var now = Date()

    private let tick = Timer.publish(every: 30, on: .main, in: .common).autoconnect()

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                hero

                if let baby = store.baby {
                    let day = Clinical.dayOfLife(birthAt: baby.birthAt, at: now)
                    let last24 = store.entries.filter { now.timeIntervalSince($0.occurredAt) <= 86_400 && $0.occurredAt <= now }

                    if store.trackedTypes.contains(.feed) {
                        nextFeedCard(baby: baby, last24: last24)
                    }
                    if store.trackedTypes.contains(.nappy) {
                        nappyQuota(day: day, last24: last24)
                    }
                    dayTagCard
                    kpiGrid(last24: last24)
                }

                Text(Clinical.disclaimer)
                    .font(.caption2)
                    .foregroundStyle(Color.faint)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 8)
                    .padding(.bottom, 90)
            }
            .padding(.horizontal, 16)
        }
        .background(SkyBackground())
        .scrollContentBackground(.hidden)
        .toolbarVisibility(.hidden, for: .navigationBar)
        .refreshable { await store.refresh() }
        .onReceive(tick) { now = $0 }
        .overlay {
            if store.loading && store.entries.isEmpty {
                ProgressView().controlSize(.large)
            }
        }
    }

    // MARK: - Hero

    private var hero: some View {
        VStack(spacing: 4) {
            if let baby = store.baby {
                Text(baby.name)
                    .font(.system(.title2, design: .rounded, weight: .bold))
                    .foregroundStyle(Color.ink)
                Text("Day \(Clinical.dayOfLife(birthAt: baby.birthAt, at: now))")
                    .font(.stat(52))
                    .foregroundStyle(Color.ink)
                    .contentTransition(.numericText())
                Text(now.formatted(.dateTime.weekday(.wide).day().month(.wide)))
                    .font(.subheadline)
                    .foregroundStyle(Color.muted)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 34)
        .padding(.bottom, 18)
    }

    // MARK: - Next feed

    @ViewBuilder
    private func nextFeedCard(baby: Baby, last24: [Entry]) -> some View {
        if let lastFeed = store.entries.first(where: { $0.type == .feed }),
           let interval = baby.feedIntervalMin {
            let due = lastFeed.occurredAt.addingTimeInterval(TimeInterval(interval * 60))
            let overdue = due < now

            HStack(spacing: 14) {
                Image(systemName: "clock.fill")
                    .font(.title3)
                    .foregroundStyle(Color.accent)
                    .frame(width: 44, height: 44)
                    .background(Color.accentSoft, in: .circle)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Next feed due")
                        .font(.caption)
                        .foregroundStyle(Color.muted)
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text(due.timeLabel)
                            .font(.stat(26))
                            .foregroundStyle(Color.ink)
                        Text(overdue
                             ? "\(minutesLabel(now.timeIntervalSince(due))) past"
                             : "in \(minutesLabel(due.timeIntervalSince(now)))")
                            .font(.footnote.weight(.medium))
                            .foregroundStyle(overdue ? Color.watch : Color.positive)
                    }
                    Text("your \(interval / 60)h interval · feed on cues")
                        .font(.caption2)
                        .foregroundStyle(Color.faint)
                }
                Spacer()
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .glassEffect(.regular, in: .rect(cornerRadius: 24))
        }
    }

    private func minutesLabel(_ seconds: TimeInterval) -> String {
        let mins = max(0, Int(seconds / 60))
        return mins < 60 ? "\(mins) min" : "\(mins / 60)h \(mins % 60)m"
    }

    // MARK: - Nappy quota

    private func nappyQuota(day: Int, last24: [Entry]) -> some View {
        let exp = Clinical.expectedNappies(day: day)
        let nappies = last24.filter { $0.type == .nappy }
        let dirty = nappies.filter { $0.dirty == true }.count
        let wet = nappies.count - dirty
        let onTrack = nappies.count >= exp.total && dirty >= exp.minDirty

        return Card {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    CardTitle("Nappies · last 24h")
                    Spacer()
                    Label(onTrack ? "On track" : "\(max(0, exp.total - nappies.count)) to go",
                          systemImage: onTrack ? "checkmark" : "hourglass")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(onTrack ? Color.positive : Color.muted)
                }

                HStack(spacing: 5) {
                    ForEach(0..<max(exp.total, nappies.count), id: \.self) { i in
                        RoundedRectangle(cornerRadius: 7)
                            .fill(i < dirty ? Color.chartBrown : i < nappies.count ? Color.chartBlue : Color.surfaceAlt)
                            .frame(height: 30)
                            .overlay {
                                if i >= nappies.count {
                                    RoundedRectangle(cornerRadius: 7).strokeBorder(Color.line, lineWidth: 1)
                                }
                            }
                    }
                }
                .animation(.snappy, value: nappies.count)

                HStack(spacing: 14) {
                    Label("\(wet) wet", systemImage: "circle.fill")
                        .foregroundStyle(Color.chartBlue)
                    Label("\(dirty) mixed (aim \(exp.minDirty)+)", systemImage: "circle.fill")
                        .foregroundStyle(Color.chartBrown)
                    Spacer()
                    Text("\(nappies.count) of \(exp.total) for day \(day)")
                        .foregroundStyle(Color.muted)
                }
                .font(.caption2)

                Text(exp.note)
                    .font(.caption2)
                    .foregroundStyle(Color.faint)
            }
        }
    }

    // MARK: - Day tags

    private var dayTagCard: some View {
        let today = now.dayKey
        let active = Set(store.dayTags.filter { $0.day == today }.map(\.tag))
        return Card {
            VStack(alignment: .leading, spacing: 10) {
                CardTitle("Mark the day")
                HStack(spacing: 8) {
                    Chip(label: "No poo", active: active.contains("no_poo")) {
                        Task { await store.toggleDayTag("no_poo", day: today) }
                    }
                    Chip(label: "Teething", active: active.contains("teething")) {
                        Task { await store.toggleDayTag("teething", day: today) }
                    }
                }
                if active.contains("no_poo") {
                    Text("Past the first weeks, breastfed babies can happily go several days between poos.")
                        .font(.caption2)
                        .foregroundStyle(Color.muted)
                }
            }
        }
    }

    // MARK: - KPIs

    private func kpiGrid(last24: [Entry]) -> some View {
        let feeds = last24.filter { $0.type == .feed }
        let sleepH = store.entries
            .filter { $0.type == .sleep }
            .reduce(0.0) { total, e in
                guard let end = e.endedAt else { return total }
                let start = max(e.occurredAt, now.addingTimeInterval(-86_400))
                let clampedEnd = min(end, now)
                return total + max(0, clampedEnd.timeIntervalSince(start)) / 3600
            }
        let latestWeight = store.entries.first { $0.type == .weight && $0.weightG != nil }

        return LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible())], spacing: 12) {
            if store.trackedTypes.contains(.feed) {
                StatTile(
                    label: "Feeds · last 24h",
                    value: "\(feeds.count)",
                    sub: "usually \(Clinical.expectedFeedsLabel)",
                    tone: feeds.count >= Clinical.expectedFeedsMin ? .positive : .watch
                )
            }
            if store.trackedTypes.contains(.sleep) {
                StatTile(
                    label: "Sleep · last 24h",
                    value: sleepH > 0 ? String(format: "%.1fh", sleepH) : "—",
                    sub: "newborns often 14–17h"
                )
            }
            if store.trackedTypes.contains(.weight) {
                StatTile(
                    label: "Latest weight",
                    value: latestWeight.flatMap { $0.weightG.map { String(format: "%.2f kg", Double($0) / 1000) } } ?? "—",
                    sub: latestWeight.map { "logged \($0.occurredAt.formatted(.dateTime.day().month()))" },
                    tone: .positive
                )
            }
            if store.trackedTypes.contains(.pump) {
                let pumped = last24.filter { $0.type == .pump }.compactMap(\.expressedMl).reduce(0, +)
                StatTile(label: "Pumped · last 24h", value: pumped > 0 ? "\(pumped) ml" : "—")
            }
        }
    }
}
