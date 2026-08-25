import SwiftUI
import Charts

struct ChartsView: View {
    @EnvironmentObject private var store: Store

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
                            CardTitle("Weight")
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
    }
}
