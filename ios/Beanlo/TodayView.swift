import SwiftUI

struct TodayView: View {
    @EnvironmentObject private var store: Store
    @Binding var logSheet: EntryType?
    @Binding var showSettings: Bool
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
                        beaGuessCard
                    }
                    if store.trackedTypes.contains(.sleep) {
                        napWindowCard(baby: baby)
                    }
                    // Medicines above nappies: an active course or a pending
                    // next-dose window is more time-critical than the quota.
                    medicineCards(baby: baby)
                    if store.trackedTypes.contains(.nappy) {
                        nappyQuota(day: day, last24: last24)
                    }
                    if store.canEdit {
                        dayTagCard
                    }
                    kpiGrid(last24: last24)
                    if store.trackedTypes.contains(.feed) {
                        feedingBreakdown(last24: last24)
                    }
                    if store.trackedTypes.contains(.nappy) {
                        colourToExpect(day: day, last24: last24)
                    }
                    if store.trackedTypes.contains(.weight) {
                        weightVsBirth(baby: baby)
                    }
                    redFlagsCard
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
        // A just-saved entry can carry occurredAt AFTER the last tick's `now`,
        // and every card filters on occurredAt <= now — bump the clock the
        // moment the data changes so new entries show immediately.
        .onChange(of: store.entries) { now = Date() }
        .overlay {
            if store.loading && store.entries.isEmpty {
                ProgressView().controlSize(.large)
            }
        }
    }

    // MARK: - Hero

    private var hero: some View {
        VStack(spacing: 4) {
            // Settings gear + Ask Bea live off the hero — Friends took the
            // fifth tab slot (iPhone collapses a sixth tab into "More").
            HStack {
                Button {
                    Haptics.tap()
                    showSettings = true
                } label: {
                    Image(systemName: "gearshape.fill")
                        .font(.subheadline)
                        .foregroundStyle(Color.ink)
                        .frame(width: 40, height: 40)
                }
                .glassEffect(.regular.interactive(), in: .circle)
                .accessibilityLabel("Settings")
                Spacer()
                if store.aiEnabled {
                    NavigationLink {
                        ChatView()
                    } label: {
                        Image(systemName: "sparkles")
                            .font(.subheadline)
                            .foregroundStyle(Color.accent)
                            .frame(width: 40, height: 40)
                    }
                    .glassEffect(.regular.interactive(), in: .circle)
                }
            }
            .padding(.horizontal, 4)

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

    // MARK: - Bea's guess (rhythm-based prediction, self-graded)

    @ViewBuilder
    private var beaGuessCard: some View {
        let starts = store.entries.filter { $0.type == .feed }.map(\.occurredAt)
        if let p = Predict.nextFeed(feedStarts: starts) {
            let overdue = p.nextAt < now
            HStack(spacing: 14) {
                Image(systemName: "sparkles")
                    .font(.title3)
                    .foregroundStyle(Color.accent)
                    .frame(width: 44, height: 44)
                    .background(Color.accentSoft, in: .circle)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Bea's guess — next feed")
                        .font(.caption)
                        .foregroundStyle(Color.muted)
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text(p.nextAt.timeLabel)
                            .font(.stat(26))
                            .foregroundStyle(Color.ink)
                        Text(overdue
                             ? "\(minutesLabel(now.timeIntervalSince(p.nextAt))) past"
                             : "in \(minutesLabel(p.nextAt.timeIntervalSince(now)))")
                            .font(.footnote.weight(.medium))
                            .foregroundStyle(overdue ? Color.watch : Color.positive)
                    }
                    Text("Their rhythm — feeds ~\(minutesLabel(p.typicalGap)) apart\(p.accuracy.map { " (\($0.hits)/\($0.n) on target)" } ?? "")")
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

    // MARK: - Nap window

    @ViewBuilder
    private func napWindowCard(baby: Baby) -> some View {
        let spans = store.entries
            .filter { $0.type == .sleep }
            .map { Predict.SleepSpan(start: $0.occurredAt, end: $0.endedAt) }
        let hasEnded = spans.contains { $0.end != nil }

        if !hasEnded {
            if !spans.isEmpty || store.entries.isEmpty {
                EmptyView()
            } else {
                Card {
                    VStack(alignment: .leading, spacing: 4) {
                        CardTitle("Nap sweet spot")
                        Text("Log a sleep or two and Bea will predict the next nap window from \(baby.name)'s own rhythm.")
                            .font(.footnote)
                            .foregroundStyle(Color.muted)
                    }
                }
            }
        } else if let p = Predict.nextNap(spans: spans, birthAt: baby.birthAt, now: now),
                  now.timeIntervalSince(p.windowEnd) < 45 * 60 {
            HStack(spacing: 14) {
                Image(systemName: "moon.zzz.fill")
                    .font(.title3)
                    .foregroundStyle(Color(light: 0x4A3AA7, dark: 0x9C8FE0))
                    .frame(width: 44, height: 44)
                    .background(Color(light: 0x4A3AA7, dark: 0x9C8FE0).opacity(0.12), in: .circle)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Nap sweet spot")
                        .font(.caption)
                        .foregroundStyle(Color.muted)
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text("\(p.windowStart.timeLabel)–\(p.windowEnd.timeLabel)")
                            .font(.stat(24))
                            .foregroundStyle(Color.ink)
                        Text(now < p.windowStart
                             ? "in \(minutesLabel(p.windowStart.timeIntervalSince(now)))"
                             : now <= p.windowEnd ? "open now" : "just passed — watch for tired cues")
                            .font(.footnote.weight(.medium))
                            .foregroundStyle(now <= p.windowEnd ? Color.positive : Color.watch)
                    }
                    Text("\(p.basisIsObserved ? "Their rhythm" : "Typical for this age") — ~\(minutesLabel(p.typicalWake)) awake\(p.accuracy.map { " (\($0.hits)/\($0.n) on target)" } ?? "") · awake since \(p.lastWoke.timeLabel)")
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

    // MARK: - Feeding breakdown

    private func feedingBreakdown(last24: [Entry]) -> some View {
        let s = Clinical.summariseFeeds(last24)
        return Card {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    CardTitle("Feeding · last 24h")
                    Spacer()
                    Text(s.mix.label)
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background((s.mix == .breast ? Color.positive : Color.accent).opacity(0.14), in: .capsule)
                        .foregroundStyle(s.mix == .breast ? Color.positive : Color.accent)
                }
                HStack(spacing: 10) {
                    feedTile("\(s.breastCount)", "breastfeeds", sub: s.breastMin > 0 ? "\(s.breastMin) min" : nil)
                    feedTile("\(s.expressedMl)", "ml expressed")
                    feedTile("\(s.formulaMl)", "ml formula")
                }
                if s.mix == .mixed {
                    Text("While formula is in the mix, expect stools between tan-pasty and yellow-seedy — trending tan → yellow-seedy as breastfeeding takes over is a good sign.")
                        .font(.caption2)
                        .foregroundStyle(Color.muted)
                }
            }
        }
    }

    private func feedTile(_ value: String, _ label: String, sub: String? = nil) -> some View {
        VStack(spacing: 2) {
            Text(value).font(.stat(22)).foregroundStyle(Color.ink)
            Text(label).font(.caption2).foregroundStyle(Color.muted)
            if let sub {
                Text(sub).font(.caption2).foregroundStyle(Color.faint)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(Color.surfaceAlt, in: .rect(cornerRadius: 16))
    }

    // MARK: - Colour to expect

    private func colourToExpect(day: Int, last24: [Entry]) -> some View {
        let mix = Clinical.summariseFeeds(last24).mix
        let key = Clinical.expectedColourKey(day: day, mix: mix)
        return Card {
            VStack(alignment: .leading, spacing: 10) {
                CardTitle("Colour to expect · day \(day)")
                HStack(alignment: .top, spacing: 12) {
                    Circle()
                        .fill(Color(light: key.swatch, dark: key.swatch))
                        .frame(width: 30, height: 30)
                        .overlay(Circle().strokeBorder(Color.line, lineWidth: 1))
                    Text(Clinical.expectedColour(day: day, mix: mix))
                        .font(.footnote)
                        .foregroundStyle(Color.ink)
                }
                Text("Pale/white/chalky stool or blood always needs same-day advice, whatever the day.")
                    .font(.caption2)
                    .foregroundStyle(Color.muted)
            }
        }
    }

    // MARK: - Weight vs birth

    @ViewBuilder
    private func weightVsBirth(baby: Baby) -> some View {
        if let latest = store.entries.first(where: { $0.type == .weight && $0.weightG != nil }),
           let g = latest.weightG {
            let ws = Clinical.weightStatus(weightG: g, birthWeightG: baby.birthWeightG)
            Card {
                VStack(alignment: .leading, spacing: 6) {
                    CardTitle("Weight vs birth")
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text(String(format: "%+.1f%%", ws.pct))
                            .font(.stat(30))
                            .foregroundStyle(toneColour(ws.tone))
                        Text(String(format: "%.2f kg vs %.2f kg at birth", Double(g) / 1000, Double(baby.birthWeightG) / 1000))
                            .font(.caption)
                            .foregroundStyle(Color.muted)
                    }
                    Text(ws.message)
                        .font(.footnote)
                        .foregroundStyle(Color.muted)
                }
            }
        }
    }

    private func toneColour(_ tone: Clinical.WeightStatus.Tone) -> Color {
        switch tone {
        case .positive: .positive
        case .alert: .alertTone
        case .watch: .watch
        case .neutral: .ink
        }
    }

    // MARK: - Medicines

    @ViewBuilder
    private func medicineCards(baby: Baby) -> some View {
        let doses = store.entries.filter {
            $0.type == .medication && $0.medKind == "dose"
            && now.timeIntervalSince($0.occurredAt) <= 7 * 86_400 && $0.occurredAt <= now
        }
        let babyDoses = grouped(doses.filter { $0.medSubject != "mother" })
        let motherDoses = grouped(doses.filter { $0.medSubject == "mother" })
        let babyCourses = store.activeCourses.filter { $0.medSubject == "baby" }
        let motherCourses = store.activeCourses.filter { $0.medSubject != "baby" }

        if !babyDoses.isEmpty || !babyCourses.isEmpty {
            medicineCard(title: "\(baby.name)'s medicines", doses: babyDoses, courses: babyCourses, footnote: nil)
        }
        if !motherDoses.isEmpty || !motherCourses.isEmpty {
            medicineCard(
                title: "Mother's medicines", doses: motherDoses, courses: motherCourses,
                footnote: "Some medication passes into breastmilk and can shift stool colour — e.g. iron often makes it darker or greener."
            )
        }
    }

    private func grouped(_ doses: [Entry]) -> [(name: String, last: Entry, in24h: Int)] {
        var out: [(String, Entry, Int)] = []
        for d in doses {
            let name = d.medName ?? "Medicine"
            let in24 = now.timeIntervalSince(d.occurredAt) <= 86_400 ? 1 : 0
            if let i = out.firstIndex(where: { $0.0.lowercased() == name.lowercased() }) {
                out[i].2 += in24
            } else {
                out.append((name, d, in24))
            }
        }
        return out
    }

    private func medicineCard(
        title: String, doses: [(name: String, last: Entry, in24h: Int)],
        courses: [Entry], footnote: String?
    ) -> some View {
        Card {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Image(systemName: "pills.fill").font(.caption).foregroundStyle(Color.muted)
                    CardTitle(title)
                    Spacer()
                    if store.canEdit {
                        Button("Log dose") {
                            Haptics.tap()
                            logSheet = .medication
                        }
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Color.accent)
                    }
                }
                ForEach(doses, id: \.last.id) { dose in
                    VStack(alignment: .leading, spacing: 1) {
                        HStack {
                            Text(dose.name).font(.system(.subheadline, design: .rounded, weight: .semibold))
                            if let d = dose.last.medDose {
                                Text(d).font(.subheadline).foregroundStyle(Color.muted)
                            }
                            Spacer()
                            Text("last given \(agoLabel(dose.last.occurredAt))")
                                .font(.caption2).foregroundStyle(Color.muted)
                        }
                        if dose.in24h > 1 {
                            Text("\(dose.in24h) doses in the last 24 h")
                                .font(.caption2).foregroundStyle(Color.faint)
                        }
                    }
                }
                ForEach(courses) { course in
                    VStack(alignment: .leading, spacing: 1) {
                        HStack {
                            Text(course.medName ?? "Medicine")
                                .font(.system(.subheadline, design: .rounded, weight: .semibold))
                            if let d = course.medDose {
                                Text(d).font(.subheadline).foregroundStyle(Color.muted)
                            }
                            Spacer()
                            Text("since \(course.occurredAt.formatted(.dateTime.day().month(.abbreviated)))")
                                .font(.caption2).foregroundStyle(Color.muted)
                        }
                        if let times = course.reminderTimes, !times.isEmpty {
                            Text("Reminders at \(times.joined(separator: ", "))")
                                .font(.caption2).foregroundStyle(Color.faint)
                        }
                    }
                }
                if let footnote {
                    Text(footnote).font(.caption2).foregroundStyle(Color.faint)
                }
            }
        }
    }

    private func agoLabel(_ date: Date) -> String {
        let mins = max(0, Int(now.timeIntervalSince(date) / 60))
        if mins < 60 { return "\(mins) min ago" }
        let h = mins / 60
        if h < 48 { return "\(h) h \(mins % 60 > 0 ? "\(mins % 60) min " : "")ago" }
        return "\(h / 24) days ago"
    }

    // MARK: - Red flags

    private var redFlagsCard: some View {
        Card {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 6) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.caption)
                        .foregroundStyle(Color.alertTone)
                    Text("When to get help")
                        .font(.system(.subheadline, design: .rounded, weight: .bold))
                        .foregroundStyle(Color.alertTone)
                }
                ForEach(Clinical.redFlags, id: \.self) { flag in
                    HStack(alignment: .top, spacing: 8) {
                        Circle().fill(Color.alertTone).frame(width: 5, height: 5).padding(.top, 6)
                        Text(flag).font(.footnote).foregroundStyle(Color.ink)
                    }
                }
            }
        }
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
            if store.trackedTypes.contains(.carerSleep) {
                let mine = store.entries.filter {
                    $0.type == .carerSleep && $0.createdBy == store.userId && $0.endedAt != nil
                }
                let hours = mine.reduce(0.0) { total, e in
                    let start = max(e.occurredAt, now.addingTimeInterval(-86_400))
                    let end = min(e.endedAt!, now)
                    return total + max(0, end.timeIntervalSince(start)) / 3600
                }
                StatTile(
                    label: "Your sleep · last 24h",
                    value: hours > 0 ? String(format: "%.1fh", hours) : "—",
                    sub: "your own logged rest"
                )
            }
        }
    }
}
