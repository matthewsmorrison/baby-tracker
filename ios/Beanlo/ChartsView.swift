import SwiftUI
import Charts

struct ChartsView: View {
    @EnvironmentObject private var store: Store
    @State private var showWHO = false

    private struct DayStat: Identifiable {
        let id: String
        let date: Date
        let dol: Int
        var feeds = 0
        var wet = 0
        var dirty = 0
        var expressedMl = 0
        var formulaMl = 0
        var nursingMin = 0
        var sleepH = 0.0
        var carerSleepH = 0.0
        var gapSum = 0.0
        var gapCount = 0
    }

    private var last14: [DayStat] {
        guard let baby = store.baby else { return [] }
        let cal = Calendar.current
        var days: [String: DayStat] = [:]
        for offset in 0..<14 {
            let date = cal.startOfDay(for: cal.date(byAdding: .day, value: -offset, to: .now)!)
            guard date >= cal.startOfDay(for: baby.birthAt) else { continue }
            days[date.dayKey] = DayStat(
                id: date.dayKey, date: date,
                dol: Clinical.dayOfLife(birthAt: baby.birthAt, at: date.addingTimeInterval(43_200))
            )
        }
        for e in store.entries {
            guard var day = days[e.occurredAt.dayKey] else { continue }
            switch e.type {
            case .feed:
                day.feeds += 1
                day.expressedMl += e.expressedMl ?? 0
                day.formulaMl += e.formulaMl ?? 0
                day.nursingMin += (e.leftMin ?? 0) + (e.rightMin ?? 0)
            case .nappy:
                if e.dirty == true { day.dirty += 1 } else { day.wet += 1 }
            case .sleep:
                if let end = e.endedAt { day.sleepH += end.timeIntervalSince(e.occurredAt) / 3600 }
            case .carerSleep:
                if let end = e.endedAt { day.carerSleepH += end.timeIntervalSince(e.occurredAt) / 3600 }
            default: break
            }
            days[e.occurredAt.dayKey] = day
        }
        // Gaps between consecutive feed starts, attributed to the later feed's day.
        let feedStarts = store.entries.filter { $0.type == .feed }.map(\.occurredAt).sorted()
        for i in 1..<max(1, feedStarts.count) {
            let gap = feedStarts[i].timeIntervalSince(feedStarts[i - 1]) / 3600
            guard gap > 0.33, gap < 8, var day = days[feedStarts[i].dayKey] else { continue }
            day.gapSum += gap
            day.gapCount += 1
            days[feedStarts[i].dayKey] = day
        }
        return days.values.sorted { $0.date < $1.date }
    }

    /// Average ml per pumping session by hour of day (all loaded history).
    private var pumpByHour: [(hour: Int, avgMl: Double, sessions: Int)] {
        var buckets: [Int: (total: Int, n: Int)] = [:]
        for e in store.entries where e.type == .pump {
            guard let ml = e.expressedMl, ml > 0 else { continue }
            let h = Calendar.current.component(.hour, from: e.occurredAt)
            buckets[h, default: (0, 0)].total += ml
            buckets[h, default: (0, 0)].n += 1
        }
        return buckets.map { (hour: $0.key, avgMl: Double($0.value.total) / Double($0.value.n), sessions: $0.value.n) }
            .sorted { $0.hour < $1.hour }
    }

    private var weights: [(date: Date, kg: Double)] {
        store.entries
            .filter { $0.type == .weight }
            .compactMap { e in e.weightG.map { (e.occurredAt, Double($0) / 1000) } }
            .sorted { $0.0 < $1.0 }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                if store.trackedTypes.contains(.feed) {
                Card {
                    VStack(alignment: .leading, spacing: 12) {
                        CardTitle("Feeds per day")
                        Chart(last14) { day in
                            BarMark(
                                x: .value("Day", "D\(day.dol)"),
                                y: .value("Feeds", day.feeds)
                            )
                            .foregroundStyle(Color.chartBlue)
                            .cornerRadius(4)
                            RuleMark(y: .value("Min", 8))
                                .foregroundStyle(Color.positiveBar.opacity(0.5))
                                .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 4]))
                        }
                        .frame(height: 180)
                        .chartYAxis { AxisMarks(position: .leading) }
                        .compactDayAxis()
                        Text("Dashed line = the 8–12 feeds/24h norm")
                            .font(.caption2).foregroundStyle(Color.faint)
                    }
                }
                }

                if store.trackedTypes.contains(.nappy) {
                Card {
                    VStack(alignment: .leading, spacing: 12) {
                        CardTitle("Nappies per day")
                        Chart(last14) { day in
                            BarMark(
                                x: .value("Day", "D\(day.dol)"),
                                y: .value("Count", day.wet)
                            )
                            .foregroundStyle(Color.chartBlue)
                            .cornerRadius(3)
                            BarMark(
                                x: .value("Day", "D\(day.dol)"),
                                y: .value("Count", day.dirty)
                            )
                            .foregroundStyle(Color.chartBrown)
                            .cornerRadius(3)
                        }
                        .frame(height: 180)
                        .chartYAxis { AxisMarks(position: .leading) }
                        .compactDayAxis()
                        HStack(spacing: 14) {
                            Label("wet", systemImage: "circle.fill").foregroundStyle(Color.chartBlue)
                            Label("mixed", systemImage: "circle.fill").foregroundStyle(Color.chartBrown)
                        }
                        .font(.caption2)
                    }
                }
                }

                if store.trackedTypes.contains(.feed) {
                    Card {
                        VStack(alignment: .leading, spacing: 12) {
                            CardTitle("Time between feeds")
                            Chart(last14.filter { $0.gapCount > 0 }) { day in
                                BarMark(
                                    x: .value("Day", "D\(day.dol)"),
                                    y: .value("Hours", day.gapSum / Double(max(1, day.gapCount)))
                                )
                                .foregroundStyle(Color.chartBlue)
                                .cornerRadius(4)
                                RectangleMark(yStart: .value("lo", 2), yEnd: .value("hi", 3))
                                    .foregroundStyle(Color.positiveBar.opacity(0.15))
                            }
                            .frame(height: 160)
                            .chartYAxis { AxisMarks(position: .leading) }
                            .compactDayAxis()
                            Text("Shaded band = every 2–3h (the 8–12 feeds/day norm)")
                                .font(.caption2).foregroundStyle(Color.faint)
                        }
                    }

                    if last14.contains(where: { $0.expressedMl + $0.formulaMl > 0 }) {
                        Card {
                            VStack(alignment: .leading, spacing: 12) {
                                CardTitle("Bottle milk per day")
                                Chart(last14) { day in
                                    BarMark(x: .value("Day", "D\(day.dol)"), y: .value("ml", day.expressedMl))
                                        .foregroundStyle(Color(light: 0x1BAF7A, dark: 0x4FC79A))
                                        .cornerRadius(3)
                                    BarMark(x: .value("Day", "D\(day.dol)"), y: .value("ml", day.formulaMl))
                                        .foregroundStyle(Color(light: 0xEDA100, dark: 0xF0B54A))
                                        .cornerRadius(3)
                                }
                                .frame(height: 160)
                                .chartYAxis { AxisMarks(position: .leading) }
                                .compactDayAxis()
                                HStack(spacing: 14) {
                                    Label("expressed", systemImage: "circle.fill")
                                        .foregroundStyle(Color(light: 0x1BAF7A, dark: 0x4FC79A))
                                    Label("formula", systemImage: "circle.fill")
                                        .foregroundStyle(Color(light: 0xEDA100, dark: 0xF0B54A))
                                }
                                .font(.caption2)
                                Text("Formula shrinking while breastmilk holds is the transition working.")
                                    .font(.caption2).foregroundStyle(Color.faint)
                            }
                        }
                    }

                    if last14.contains(where: { $0.nursingMin > 0 }) {
                        Card {
                            VStack(alignment: .leading, spacing: 12) {
                                CardTitle("Nursing per day")
                                Chart(last14) { day in
                                    BarMark(x: .value("Day", "D\(day.dol)"), y: .value("min", day.nursingMin))
                                        .foregroundStyle(Color.accent)
                                        .cornerRadius(4)
                                }
                                .frame(height: 150)
                                .chartYAxis { AxisMarks(position: .leading) }
                                .compactDayAxis()
                            }
                        }
                    }
                }

                if store.trackedTypes.contains(.sleep), last14.contains(where: { $0.sleepH > 0 }) {
                    Card {
                        VStack(alignment: .leading, spacing: 12) {
                            CardTitle("Sleep per day")
                            Chart(last14) { day in
                                BarMark(x: .value("Day", "D\(day.dol)"), y: .value("h", day.sleepH))
                                    .foregroundStyle(Color(light: 0x4A3AA7, dark: 0x9C8FE0))
                                    .cornerRadius(4)
                                RectangleMark(yStart: .value("lo", 14), yEnd: .value("hi", 17))
                                    .foregroundStyle(Color.positiveBar.opacity(0.15))
                            }
                            .frame(height: 160)
                            .chartYAxis { AxisMarks(position: .leading) }
                            .compactDayAxis()
                            Text("Newborn sleep varies hugely — the band is the often-quoted 14–17h.")
                                .font(.caption2).foregroundStyle(Color.faint)
                        }
                    }
                }

                if store.trackedTypes.contains(.pump), !pumpByHour.isEmpty {
                    Card {
                        VStack(alignment: .leading, spacing: 12) {
                            CardTitle("Pumping — best time of day")
                            Chart(pumpByHour, id: \.hour) { row in
                                BarMark(x: .value("Hour", "\(row.hour)"), y: .value("ml", row.avgMl))
                                    .foregroundStyle(Color(light: 0x0F8A8A, dark: 0x4FB3B3))
                                    .cornerRadius(3)
                            }
                            .frame(height: 150)
                            .chartYAxis { AxisMarks(position: .leading) }
                            Text("Average ml per session by hour — pump when your output tends to be highest (\(pumpByHour.reduce(0) { $0 + $1.sessions }) sessions logged).")
                                .font(.caption2).foregroundStyle(Color.faint)
                        }
                    }
                }

                if store.trackedTypes.contains(.carerSleep), last14.contains(where: { $0.carerSleepH > 0 }) {
                    Card {
                        VStack(alignment: .leading, spacing: 12) {
                            CardTitle("Carer sleep per day")
                            Chart(last14) { day in
                                BarMark(x: .value("Day", "D\(day.dol)"), y: .value("h", day.carerSleepH))
                                    .foregroundStyle(Color(light: 0x8A4A7A, dark: 0xC08AB0))
                                    .cornerRadius(4)
                            }
                            .frame(height: 140)
                            .chartYAxis { AxisMarks(position: .leading) }
                            .compactDayAxis()
                            Text("Look after yourselves too.")
                                .font(.caption2).foregroundStyle(Color.faint)
                        }
                    }
                }

                if store.trackedTypes.contains(.weight), weights.count >= 2 {
                    Card {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                CardTitle("Weight")
                                Spacer()
                                Button {
                                    Haptics.tap()
                                    showWHO = true
                                } label: {
                                    Label("WHO chart", systemImage: "arrow.up.left.and.arrow.down.right")
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(Color.accent)
                                }
                            }
                            Chart(weights, id: \.date) { point in
                                LineMark(
                                    x: .value("Date", point.date),
                                    y: .value("kg", point.kg)
                                )
                                .foregroundStyle(Color.ink)
                                .interpolationMethod(.catmullRom)
                                PointMark(
                                    x: .value("Date", point.date),
                                    y: .value("kg", point.kg)
                                )
                                .foregroundStyle(Color.ink)
                            }
                            .frame(height: 200)
                            .chartYScale(domain: .automatic(includesZero: false))
                            .chartYAxis { AxisMarks(position: .leading) }
                            if let birth = store.baby.map({ Double($0.birthWeightG) / 1000 }),
                               let latest = weights.last?.kg {
                                let pct = (latest - birth) / birth * 100
                                Text(String(format: "%+.1f%% vs birth (%.2f kg)", pct, birth))
                                    .font(.caption)
                                    .foregroundStyle(pct >= 0 ? Color.positive : Color.watch)
                            }
                        }
                    }
                }

                Text(Clinical.disclaimer)
                    .font(.caption2)
                    .foregroundStyle(Color.faint)
                    .multilineTextAlignment(.center)
                    .padding(.bottom, 90)
            }
            .padding(.horizontal, 16)
        }
        .background(Color.sand)
        .navigationTitle("Charts")
        .refreshable { await store.refresh() }
        .sheet(isPresented: $showWHO) {
            WHOChartView(weights: weights)
        }
        #if DEBUG
        .onAppear {
            if UserDefaults.standard.bool(forKey: "DevWHO") { showWHO = true }
        }
        #endif
    }
}

/// Categorical day labels ("D12") get ellipsised to "D…" at the default
/// axis font once 14 bars share the width — a smaller face keeps them whole.
private extension View {
    func compactDayAxis() -> some View {
        chartXAxis {
            AxisMarks { value in
                AxisValueLabel {
                    if let label = value.as(String.self) {
                        Text(label).font(.system(size: 8, design: .rounded))
                    }
                }
            }
        }
    }
}

/// Full-screen UK-WHO (red book) weight-for-age chart: the nine printed
/// centile curves for the baby's sex, with every logged weight plotted.
struct WHOChartView: View {
    @EnvironmentObject private var store: Store
    @Environment(\.dismiss) private var dismiss
    let weights: [(date: Date, kg: Double)]
    @State private var measure: Measure = .weight
    @State private var selectedWeeks: Double?

    enum Measure: String, CaseIterable, Identifiable {
        case weight = "Weight"
        case height = "Height"
        case head = "Head"
        var id: String { rawValue }
    }

    var body: some View {
        NavigationStack {
            Group {
                if let baby = store.baby, let sex = baby.sex {
                    VStack(spacing: 0) {
                        Picker("Measure", selection: $measure) {
                            ForEach(Measure.allCases) { m in Text(m.rawValue).tag(m) }
                        }
                        .pickerStyle(.segmented)
                        .padding(.horizontal, 16)
                        .padding(.top, 6)
                        .onChange(of: measure) { selectedWeeks = nil }
                        chart(baby: baby, isBoy: sex == "boy")
                    }
                } else {
                    ContentUnavailableView(
                        "Set your baby's sex first",
                        systemImage: "chart.xyaxis.line",
                        description: Text("The WHO chart needs it to pick the right centile curves — Settings → Baby → Sex.")
                    )
                }
            }
            .background(Color.sand)
            .navigationTitle("UK-WHO weight chart")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .presentationBackground(Color.sand)
    }

    private func chart(baby: Baby, isBoy: Bool) -> some View {
        // The red book prints boys in blue, girls in pink.
        let curveColour = isBoy
            ? Color(light: 0x4383B4, dark: 0x6FA5CC)
            : Color(light: 0xC76585, dark: 0xD98BA5)
        let ageDays = Date().timeIntervalSince(baby.birthAt) / 86_400
        let horizonDays = min(730.0, max(120, ageDays * 1.35))

        // Sample each centile curve: every 3.5 days through the steep first
        // 13 weeks, then roughly weekly.
        var sampleAges: [Double] = stride(from: 0.0, through: min(91, horizonDays), by: 3.5).map { $0 }
        if horizonDays > 91 {
            sampleAges += stride(from: 98.0, through: horizonDays, by: 7).map { $0 }
        }

        // Points + curve function per measure. Birth weight is included
        // automatically on the weight chart, like the web.
        let points: [(age: Double, value: Double)]
        let unit: String
        let curveValue: (Double, Double) -> Double
        let centileOf: ((age: Double, value: Double)) -> Double
        switch measure {
        case .weight:
            var w = weights.map { (age: $0.date.timeIntervalSince(baby.birthAt) / 86_400, value: $0.kg) }
            if w.first?.age ?? 1 > 0.5 { w.insert((age: 0, value: Double(baby.birthWeightG) / 1000), at: 0) }
            points = w
            unit = "kg"
            curveValue = { age, z in WHOWeight.weightAtZ(isBoy: isBoy, ageDays: age, z: z) / 1000 }
            centileOf = { WHOWeight.centile(isBoy: isBoy, ageDays: $0.age, weightG: $0.value * 1000) }
        case .height:
            points = store.entries
                .filter { $0.type == .weight }
                .compactMap { e in e.lengthMm.map { (age: e.occurredAt.timeIntervalSince(baby.birthAt) / 86_400, value: Double($0) / 10) } }
                .sorted { $0.age < $1.age }
            unit = "cm"
            curveValue = { age, z in WHOGrowth.measureAtZ(.length, isBoy: isBoy, ageDays: age, z: z) }
            centileOf = { WHOGrowth.centile(.length, isBoy: isBoy, ageDays: $0.age, cm: $0.value) }
        case .head:
            points = store.entries
                .filter { $0.type == .weight }
                .compactMap { e in e.headCircMm.map { (age: e.occurredAt.timeIntervalSince(baby.birthAt) / 86_400, value: Double($0) / 10) } }
                .sorted { $0.age < $1.age }
            unit = "cm"
            curveValue = { age, z in WHOGrowth.measureAtZ(.head, isBoy: isBoy, ageDays: age, z: z) }
            centileOf = { WHOGrowth.centile(.head, isBoy: isBoy, ageDays: $0.age, cm: $0.value) }
        }

        let latestCentile: Double? = points.last.map(centileOf)

        return ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Chart {
                    ForEach(WHOWeight.ukCentiles, id: \.label) { centile in
                        ForEach(sampleAges, id: \.self) { age in
                            LineMark(
                                x: .value("Age", age / 7),
                                y: .value(unit, curveValue(age, centile.z)),
                                series: .value("Centile", centile.label)
                            )
                            .foregroundStyle(curveColour.opacity(centile.label == "50" ? 0.75 : 0.35))
                            .lineStyle(StrokeStyle(lineWidth: centile.label == "50" ? 1.6 : 1))
                        }
                    }
                    ForEach(points.indices, id: \.self) { i in
                        LineMark(
                            x: .value("Age", points[i].age / 7),
                            y: .value(unit, points[i].value),
                            series: .value("Centile", "baby")
                        )
                        .foregroundStyle(Color.ink)
                        .lineStyle(StrokeStyle(lineWidth: 2.5))
                        PointMark(
                            x: .value("Age", points[i].age / 7),
                            y: .value(unit, points[i].value)
                        )
                        .foregroundStyle(Color.ink)
                        .symbolSize(46)
                    }
                    // Tap (or drag) picks the nearest logged point and shows
                    // its value + centile, like tapping a dot on the web chart.
                    if let sel = selectedWeeks,
                       let p = points.min(by: { abs($0.age / 7 - sel) < abs($1.age / 7 - sel) }) {
                        RuleMark(x: .value("Age", p.age / 7))
                            .foregroundStyle(Color.faint.opacity(0.6))
                            .lineStyle(StrokeStyle(lineWidth: 1, dash: [3, 3]))
                        PointMark(
                            x: .value("Age", p.age / 7),
                            y: .value(unit, p.value)
                        )
                        .foregroundStyle(Color.accent)
                        .symbolSize(110)
                        .annotation(
                            position: .top,
                            spacing: 8,
                            overflowResolution: .init(x: .fit(to: .chart), y: .fit(to: .chart))
                        ) {
                            let days = Int(p.age.rounded())
                            VStack(spacing: 2) {
                                Text(unit == "kg"
                                     ? String(format: "%.2f kg", p.value)
                                     : String(format: "%.1f cm", p.value))
                                    .font(.system(.subheadline, design: .rounded, weight: .bold))
                                Text(centileLabel(centileOf((age: p.age, value: p.value))))
                                    .font(.caption2.weight(.semibold))
                                    .foregroundStyle(Color.accent)
                                Text(days < 7 ? "day \(days)" : "\(days / 7)w \(days % 7)d")
                                    .font(.caption2)
                                    .foregroundStyle(Color.muted)
                            }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(Color.surface, in: .rect(cornerRadius: 12))
                            .shadow(color: .black.opacity(0.12), radius: 8, y: 2)
                        }
                    }
                }
                .chartXSelection(value: $selectedWeeks)
                .chartXAxisLabel("age in weeks")
                .chartYAxisLabel(unit)
                .chartYAxis { AxisMarks(position: .leading) }
                .chartYScale(domain: .automatic(includesZero: false))
                .frame(height: 420)
                .padding(.top, 8)

                if points.isEmpty {
                    Card(padding: 14) {
                        Text("No \(measure == .height ? "height" : "head circumference") logged yet — add it under Log → Measurements.")
                            .font(.system(.subheadline, design: .rounded))
                            .foregroundStyle(Color.muted)
                    }
                } else if let latestCentile {
                    Card(padding: 14) {
                        Text("Latest \(measure.rawValue.lowercased()) sits around the **\(centileLabel(latestCentile))** for a \(isBoy ? "boy" : "girl") this age.")
                            .font(.system(.subheadline, design: .rounded))
                    }
                }

                Text("Centile lines are the nine printed on the UK-WHO charts in your red book (0.4th–99.6th). Term babies are plotted with no gestational correction — the plotted red book remains the clinical reference. \(Clinical.disclaimer)")
                    .font(.caption2)
                    .foregroundStyle(Color.faint)
            }
            .padding(16)
        }
        .background(Color.sand)
    }

    private func centileLabel(_ pct: Double) -> String {
        if pct < 0.4 { return "0.4th centile or below" }
        if pct > 99.6 { return "99.6th centile or above" }
        let r = Int(pct.rounded())
        let suffix: String
        switch (r % 100, r % 10) {
        case (11...13, _): suffix = "th"
        case (_, 1): suffix = "st"
        case (_, 2): suffix = "nd"
        case (_, 3): suffix = "rd"
        default: suffix = "th"
        }
        return "\(r)\(suffix) centile"
    }
}
