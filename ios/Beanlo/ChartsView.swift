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
            case .feed: day.feeds += 1
            case .nappy: if e.dirty == true { day.dirty += 1 } else { day.wet += 1 }
            default: break
            }
            days[e.occurredAt.dayKey] = day
        }
        return days.values.sorted { $0.date < $1.date }
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
                        Text("Dashed line = the 8–12 feeds/24h norm")
                            .font(.caption2).foregroundStyle(Color.faint)
                    }
                }

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
                        HStack(spacing: 14) {
                            Label("wet", systemImage: "circle.fill").foregroundStyle(Color.chartBlue)
                            Label("mixed", systemImage: "circle.fill").foregroundStyle(Color.chartBrown)
                        }
                        .font(.caption2)
                    }
                }

                if weights.count >= 2 {
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

/// Full-screen UK-WHO (red book) weight-for-age chart: the nine printed
/// centile curves for the baby's sex, with every logged weight plotted.
struct WHOChartView: View {
    @EnvironmentObject private var store: Store
    @Environment(\.dismiss) private var dismiss
    let weights: [(date: Date, kg: Double)]

    var body: some View {
        NavigationStack {
            Group {
                if let baby = store.baby, let sex = baby.sex {
                    chart(baby: baby, isBoy: sex == "boy")
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

        let points = weights.map { (
            age: $0.date.timeIntervalSince(baby.birthAt) / 86_400,
            kg: $0.kg
        ) }

        let latestCentile: Double? = points.last.map {
            WHOWeight.centile(isBoy: isBoy, ageDays: $0.age, weightG: $0.kg * 1000)
        }

        return ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Chart {
                    ForEach(WHOWeight.ukCentiles, id: \.label) { centile in
                        ForEach(sampleAges, id: \.self) { age in
                            LineMark(
                                x: .value("Age", age / 7),
                                y: .value("kg", WHOWeight.weightAtZ(isBoy: isBoy, ageDays: age, z: centile.z) / 1000),
                                series: .value("Centile", centile.label)
                            )
                            .foregroundStyle(curveColour.opacity(centile.label == "50" ? 0.75 : 0.35))
                            .lineStyle(StrokeStyle(lineWidth: centile.label == "50" ? 1.6 : 1))
                        }
                    }
                    ForEach(points.indices, id: \.self) { i in
                        LineMark(
                            x: .value("Age", points[i].age / 7),
                            y: .value("kg", points[i].kg),
                            series: .value("Centile", "baby")
                        )
                        .foregroundStyle(Color.ink)
                        .lineStyle(StrokeStyle(lineWidth: 2.5))
                        PointMark(
                            x: .value("Age", points[i].age / 7),
                            y: .value("kg", points[i].kg)
                        )
                        .foregroundStyle(Color.ink)
                        .symbolSize(46)
                    }
                }
                .chartXAxisLabel("age in weeks")
                .chartYAxisLabel("kg")
                .chartYAxis { AxisMarks(position: .leading) }
                .chartYScale(domain: .automatic(includesZero: false))
                .frame(height: 440)
                .padding(.top, 8)

                if let latestCentile {
                    Card(padding: 14) {
                        Text("Latest weight sits around the **\(centileLabel(latestCentile))** for a \(isBoy ? "boy" : "girl") this age.")
                            .font(.system(.subheadline, design: .rounded))
                    }
                }

                Text("Centile lines are the nine printed on the UK-WHO charts in your red book (0.4th–99.6th). Weighing on the same scales, at the same time of day, makes trends more meaningful. \(Clinical.disclaimer)")
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
