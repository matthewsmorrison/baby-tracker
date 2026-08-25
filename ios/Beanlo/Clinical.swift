import Foundation

// NHS/NCT-anchored guidance, ported from the web app's lib/clinical.ts.
// beanlo is a tracking aid, not medical advice.

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
    static func dayOfLife(birthAt: Date, at date: Date = .now) -> Int {
        max(1, Int(date.timeIntervalSince(birthAt) / 86_400) + 1)
    }

    static let disclaimer = "Beanlo is a tracking aid, not medical advice or diagnosis. If you are worried about your baby, contact your midwife, health visitor or doctor."
}
