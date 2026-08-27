import Foundation

// NHS/NCT-anchored guidance, ported from the web app's lib/clinical.ts.
// Beanlo is a tracking aid, not medical advice.

enum Clinical {
    static let expectedFeedsLabel = "8–12"
    static let expectedFeedsMin = 6

    struct NappyExpectation {
        let total: Int
        let minDirty: Int
        let note: String
    }

    /// NCT day-by-day nappy quota: `total` in 24h, at least `minDirty` with poo.
    static func expectedNappies(day: Int) -> NappyExpectation {
        if day <= 2 {
            return .init(total: 3, minDirty: 1, note: "Meconium (dark, sticky) is normal now.")
        }
        if day <= 4 {
            return .init(total: 5, minDirty: 2, note: "Poo changing to green ‘changing stools’ as milk comes in.")
        }
        if day <= 6 {
            return .init(total: 7, minDirty: 2, note: "No more meconium — soft yellow poos, at least £2-coin sized.")
        }
        return .init(total: 8, minDirty: 2, note: "At least two good yellow poos a day — bigger than a £2 coin, not just skid marks.")
    }

    /// Day of life: day 1 is the birth day.
    /// Notification copy for a one-off "next dose is now allowed" reminder.
    /// Deliberately says "OK now", never "give it now" — a ceiling, not an
    /// instruction.
    static func nextDoseCopy(medName: String?, subject: String?, babyName: String) -> (title: String, body: String) {
        let who = subject == "mother" ? "Mum" : babyName
        return (
            title: "\(who) — next \(medName ?? "medicine") dose OK now",
            body: "The gap since the last dose is up. Only give it if it's needed — and stick to the pack/prescription limits."
        )
    }

    static func dayOfLife(birthAt: Date, at date: Date = .now) -> Int {
        max(1, Int(date.timeIntervalSince(birthAt) / 86_400) + 1)
    }

    static let disclaimer = "Beanlo is a tracking aid, not medical advice or diagnosis. If you are worried about your baby, contact your midwife, health visitor or doctor."

    /// Red flags to watch — general safety-netting, not diagnosis.
    static let redFlags: [String] = [
        "Pale, white or chalky stool at any age — contact your midwife or GP today",
        "Blood in the nappy (in stool or urine) — seek advice today",
        "Meconium (black, tarry) stool still appearing at day 5 or later",
        "Fewer wet nappies than expected for the day, or dark/strong urine after day 4",
        "Weight loss of more than 10% from birth weight",
        "Baby unusually sleepy, floppy, or hard to wake for feeds",
        "Fewer than 6 feeds in 24 hours, or refusing feeds",
        "Jaundice that is worsening, or a jaundiced baby who is sleepy and feeding poorly",
        "Dry mouth, sunken fontanelle, or no tears when crying",
    ]

    // MARK: - Feeding mix

    enum FeedMix: String {
        case breast, mixed, formula, unknown
        var label: String {
            switch self {
            case .breast: "Breastmilk only"
            case .mixed: "Mixed feeding"
            case .formula: "Formula only"
            case .unknown: "No feeds logged"
            }
        }
    }

    struct FeedSummary {
        var breastCount = 0
        var breastMin = 0
        var formulaMl = 0
        var expressedMl = 0
        var sessions = 0
        var mix: FeedMix = .unknown
    }

    /// Counts + feeding mix from feed entries — mirror of lib/clinical.ts.
    static func summariseFeeds(_ entries: [Entry]) -> FeedSummary {
        var s = FeedSummary()
        let feeds = entries.filter { $0.type == .feed }
        s.sessions = feeds.count
        for f in feeds {
            let mins = (f.leftMin ?? 0) + (f.rightMin ?? 0)
            if mins > 0 {
                s.breastCount += 1
                s.breastMin += mins
            }
            s.expressedMl += f.expressedMl ?? (f.feedType == "expressed" ? (f.volumeMl ?? 0) : 0)
            s.formulaMl += f.formulaMl ?? (f.feedType == "formula" ? (f.volumeMl ?? 0) : 0)
        }
        let hasBreast = s.breastCount > 0 || s.expressedMl > 0
        let hasFormula = s.formulaMl > 0
        s.mix = hasBreast && hasFormula ? .mixed : hasFormula ? .formula : hasBreast ? .breast : .unknown
        return s
    }

    // MARK: - Expected stool colour (day × mix)

    static func expectedColourKey(day: Int, mix: FeedMix) -> StoolColour {
        if day <= 2 { return .meconium }
        if day <= 4 { return .transitional }
        if mix == .formula { return .brown }
        if mix == .mixed { return .tan }
        return .yellow
    }

    static func expectedColour(day: Int, mix: FeedMix) -> String {
        if day <= 2 { return "Meconium — black-green, tarry and sticky" }
        if day <= 4 { return "Transitional — green-brown, looser as milk comes in" }
        if mix == .formula {
            return "Tan to brown, pasty (like peanut butter), stronger smelling — normal on formula"
        }
        if mix == .mixed {
            return "Anywhere from tan-pasty to yellow-seedy. Trending tan → yellow and seedier is a good sign breastfeeding is taking over"
        }
        return "Mustard yellow, seedy and quite runny — normal for breastmilk (including expressed)"
    }

    // MARK: - Weight guidance

    /// NHS-anchored expected weight for a day, when sex (→ WHO band) is unset.
    private static let weightAnchors: [(day: Double, fraction: Double)] = [
        (1, 1.0), (3, 0.945), (4, 0.94), (7, 0.955), (10, 0.97), (14, 0.985), (21, 1.0),
    ]

    static func expectedWeightBand(day: Int, birthWeightG: Int) -> (low: Int, mid: Int, high: Int) {
        let d = Double(day)
        var mid: Double
        if d >= 21 {
            mid = Double(birthWeightG) + ((d - 21) / 7) * 175
        } else {
            var lo = weightAnchors[0]
            var hi = weightAnchors[weightAnchors.count - 1]
            for i in 0..<(weightAnchors.count - 1)
            where d >= weightAnchors[i].day && d <= weightAnchors[i + 1].day {
                lo = weightAnchors[i]
                hi = weightAnchors[i + 1]
                break
            }
            let span = hi.day - lo.day == 0 ? 1 : hi.day - lo.day
            let t = (d - lo.day) / span
            mid = Double(birthWeightG) * (lo.fraction + t * (hi.fraction - lo.fraction))
        }
        let margin = max(80, Int((Double(birthWeightG) * 0.03).rounded()))
        return (Int(mid.rounded()) - margin, Int(mid.rounded()), Int(mid.rounded()) + margin)
    }

    /// WHO 2nd–98th centile band when sex is known, else the rough guide.
    static func weightBand(day: Int, birthWeightG: Int, sex: String?) -> (low: Int, mid: Int, high: Int) {
        guard let sex else { return expectedWeightBand(day: day, birthWeightG: birthWeightG) }
        let isBoy = sex == "boy"
        let age = Double(day)
        return (
            Int(WHOWeight.weightAtZ(isBoy: isBoy, ageDays: age, z: -2.0537)),
            Int(WHOWeight.weightAtZ(isBoy: isBoy, ageDays: age, z: 0)),
            Int(WHOWeight.weightAtZ(isBoy: isBoy, ageDays: age, z: 2.0537))
        )
    }

    struct WeightStatus {
        let pct: Double
        let tone: Tone
        let message: String
        enum Tone { case positive, neutral, watch, alert }
    }

    static func weightStatus(weightG: Int, birthWeightG: Int) -> WeightStatus {
        let pct = (Double(weightG - birthWeightG) / Double(birthWeightG)) * 100
        if pct >= 0 {
            return .init(pct: pct, tone: .positive, message: "At or above birth weight — the line is heading the right way.")
        }
        let loss = -pct
        if loss > 10 {
            return .init(pct: pct, tone: .alert, message: "More than 10% below birth weight — seek advice from your midwife or doctor now.")
        }
        if loss > 7 {
            return .init(pct: pct, tone: .watch, message: "More than 7% below birth weight — mention this to your midwife today.")
        }
        return .init(pct: pct, tone: .neutral, message: "Within the normal early loss range (up to ~7%). Most babies are back to birthweight by about 3 weeks.")
    }

    // MARK: - Nappy weighing

    /// A used nappy this much heavier than dry counts as wet (1 g ≈ 1 ml).
    static let nappyWetThresholdG = 15

    static func nappyOutputG(nappyWeightG: Int?, baseWeightG: Int?) -> Int? {
        guard let nappyWeightG, let baseWeightG else { return nil }
        return max(0, nappyWeightG - baseWeightG)
    }
}
