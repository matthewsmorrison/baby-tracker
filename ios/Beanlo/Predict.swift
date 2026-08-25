import Foundation

// Prediction engines built on the baby's own logged rhythm, with
// self-grading — a faithful port of the web app's lib/predict.ts so both
// apps make identical guesses from identical data.

enum Predict {
    static let toleranceMin = 20.0
    private static let minGap: TimeInterval = 20 * 60
    private static let maxGap: TimeInterval = 8 * 3600
    private static let sample = 10
    private static let nightStartH = 22
    private static let nightEndH = 7

    struct Accuracy {
        let n: Int
        let hits: Int
    }

    struct FeedPrediction {
        let nextAt: Date
        let typicalGap: TimeInterval
        let accuracy: Accuracy?
    }

    private static func isNight(_ date: Date) -> Bool {
        let h = Calendar.current.component(.hour, from: date)
        return h >= nightStartH || h < nightEndH
    }

    private static func median(_ values: [Double]) -> Double {
        let sorted = values.sorted()
        guard !sorted.isEmpty else { return 0 }
        let mid = sorted.count / 2
        return sorted.count.isMultiple(of: 2) ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
    }

    private static func typicalGapAfter(_ startsAsc: [Date], from: Date) -> TimeInterval? {
        var gaps: [(from: Date, gap: TimeInterval)] = []
        for i in 1..<max(1, startsAsc.count) {
            if startsAsc[i] > from { break }
            let gap = startsAsc[i].timeIntervalSince(startsAsc[i - 1])
            if gap >= minGap && gap <= maxGap {
                gaps.append((startsAsc[i - 1], gap))
            }
        }
        guard gaps.count >= 3 else { return nil }
        let samePeriod = gaps.filter { isNight($0.from) == isNight(from) }
        let pool = samePeriod.count >= 3 ? samePeriod : gaps
        return median(pool.suffix(sample).map(\.gap))
    }

    /// Next feed from feed start times; backtested. Nil until 4+ feeds.
    static func nextFeed(feedStarts: [Date], maxBacktest: Int = 30) -> FeedPrediction? {
        let starts = feedStarts.sorted()
        guard starts.count >= 4, let last = starts.last,
              let typicalGap = typicalGapAfter(starts, from: last) else { return nil }

        var n = 0
        var hits = 0
        let firstEvaluable = max(4, starts.count - maxBacktest)
        for i in firstEvaluable..<starts.count {
            let prev = starts[i - 1]
            guard let gap = typicalGapAfter(Array(starts[0..<i]), from: prev) else { continue }
            n += 1
            if abs(prev.addingTimeInterval(gap).timeIntervalSince(starts[i])) <= toleranceMin * 60 {
                hits += 1
            }
        }
        return FeedPrediction(
            nextAt: last.addingTimeInterval(typicalGap),
            typicalGap: typicalGap,
            accuracy: n >= 5 ? Accuracy(n: n, hits: hits) : nil
        )
    }

    // MARK: - Nap window

    struct SleepSpan {
        let start: Date
        let end: Date?
    }

    struct NapPrediction {
        let windowStart: Date
        let windowEnd: Date
        let lastWoke: Date
        let typicalWake: TimeInterval
        let basisIsObserved: Bool
        let accuracy: Accuracy?
    }

    private static let wakeMin: TimeInterval = 15 * 60
    private static let wakeMax: TimeInterval = 5 * 3600

    /// Typical awake-stretch defaults by age (midpoints of UK guidance).
    private static let ageWakeWindows: [(maxAgeDays: Int, minutes: Double)] = [
        (28, 50), (60, 75), (90, 90), (120, 105), (180, 135),
        (270, 180), (365, 210), (545, 285), (Int.max, 330),
    ]

    private static func wakeWindows(_ spans: [SleepSpan]) -> [(wokeAt: Date, window: TimeInterval)] {
        let ended = spans.compactMap { span -> (start: Date, end: Date)? in
            guard let end = span.end else { return nil }
            return (span.start, end)
        }.sorted { $0.start < $1.start }
        var out: [(Date, TimeInterval)] = []
        for i in 1..<max(1, ended.count) {
            let window = ended[i].start.timeIntervalSince(ended[i - 1].end)
            if window >= wakeMin && window <= wakeMax {
                out.append((ended[i - 1].end, window))
            }
        }
        return out
    }

    private static func typicalWakeAfter(
        _ windows: [(wokeAt: Date, window: TimeInterval)], wokeAt: Date
    ) -> TimeInterval? {
        let prior = windows.filter { $0.wokeAt < wokeAt }
        guard prior.count >= 4 else { return nil }
        let samePeriod = prior.filter { isNight($0.wokeAt) == isNight(wokeAt) }
        let pool = samePeriod.count >= 4 ? samePeriod : prior
        return median(pool.suffix(sample).map(\.window))
    }

    /// Sweet-spot window for the next nap. Nil while asleep / no ended sleeps.
    static func nextNap(
        spans: [SleepSpan], birthAt: Date, now: Date = .now, maxBacktest: Int = 30
    ) -> NapPrediction? {
        let asleep = spans.contains {
            $0.end == nil && $0.start <= now && now.timeIntervalSince($0.start) < 12 * 3600
        }
        if asleep { return nil }

        let lastWoke = spans.compactMap { span -> Date? in
            guard let end = span.end, end <= now else { return nil }
            return end
        }.max()
        guard let lastWoke else { return nil }

        let windows = wakeWindows(spans)
        let observed = typicalWakeAfter(windows, wokeAt: now)
        let ageDays = max(1, Int(now.timeIntervalSince(birthAt) / 86_400) + 1)
        let typicalWake = observed
            ?? (ageWakeWindows.first { ageDays <= $0.maxAgeDays }!.minutes * 60)

        let tol = min(max(typicalWake * 0.15, 10 * 60), 30 * 60)

        var n = 0
        var hits = 0
        let firstEvaluable = max(4, windows.count - maxBacktest)
        if windows.count > firstEvaluable {
            for i in firstEvaluable..<windows.count {
                guard let guess = typicalWakeAfter(Array(windows[0..<i]), wokeAt: windows[i].wokeAt) else { continue }
                n += 1
                if abs(guess - windows[i].window) <= tol { hits += 1 }
            }
        }

        return NapPrediction(
            windowStart: lastWoke.addingTimeInterval(typicalWake - tol),
            windowEnd: lastWoke.addingTimeInterval(typicalWake + tol),
            lastWoke: lastWoke,
            typicalWake: typicalWake,
            basisIsObserved: observed != nil,
            accuracy: observed != nil && n >= 5 ? Accuracy(n: n, hits: hits) : nil
        )
    }
}
