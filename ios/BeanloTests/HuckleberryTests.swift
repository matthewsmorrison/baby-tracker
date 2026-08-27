import XCTest
@testable import Beanlo

/// The Huckleberry CSV import: parsing quirks (quoted fields, MM:SS vs HH:MM
/// durations, oz→ml, lb→g) and the promise that nothing is ever guessed.
final class HuckleberryTests: XCTestCase {
    private let babyId = UUID()
    private let userId = UUID()

    func testTypicalExportPlansCorrectEntries() {
        let csv = """
        Type,Start,End,Duration,Start Condition,Start Location,End Condition,Notes
        Feed,2026-08-20 09:15,2026-08-20 09:35,00:20,10:00,,08:30,
        Feed,2026-08-20 12:00,2026-08-20 12:10,00:10,Breast milk,Bottle,3 oz,
        Diaper,2026-08-20 10:02,,,Pee,,,"changed by, gran"
        Diaper,2026-08-20 13:40,,,Pee + Poo,,,
        Sleep,2026-08-20 11:00,2026-08-20 12:30,01:30,,,,
        Growth,2026-08-21 08:00,,,3.62 kg,,,"53 cm"
        """
        let plan = Huckleberry.plan(csv: csv, babyId: babyId, userId: userId)

        XCTAssertEqual(plan.totalRows, 6)
        XCTAssertTrue(plan.problems.isEmpty, "\(plan.problems)")

        let feeds = plan.drafts.filter { $0.type == .feed }
        XCTAssertEqual(feeds.count, 2)
        // "10:00" under a 3h cap is 10 minutes (MM:SS), not 10 hours —
        // and 08:30 (8.5 min) rounds to 9.
        let breast = feeds.first { $0.feedType == "breast" }
        XCTAssertEqual(breast?.leftMin, 10)
        XCTAssertEqual(breast?.rightMin, 9)
        // Bottle of breast milk: 3 oz ≈ 89 ml, recorded as expressed.
        let bottle = feeds.first { $0.feedType == "expressed" }
        XCTAssertEqual(Double(bottle?.expressedMl ?? 0), 89, accuracy: 1)

        let nappies = plan.drafts.filter { $0.type == .nappy }
        XCTAssertEqual(nappies.count, 2)
        XCTAssertEqual(nappies.filter { $0.dirty == true }.count, 1)
        XCTAssertEqual(nappies.first?.note, "changed by, gran")

        let sleeps = plan.drafts.filter { $0.type == .sleep }
        XCTAssertEqual(sleeps.count, 1)
        XCTAssertNotNil(sleeps[0].endedAt)

        let weights = plan.drafts.filter { $0.type == .weight }
        XCTAssertEqual(weights.count, 1)
        XCTAssertEqual(weights[0].weightG, 3620)
    }

    func testUnreadableRowsAreReportedNotGuessed() {
        let csv = """
        Type,Start,End,Duration,Start Condition
        Meditation,2026-08-20 09:15,,,
        Diaper,2026-08-20 10:00,,,Mystery contents
        Sleep,not-a-date,,,
        """
        let plan = Huckleberry.plan(csv: csv, babyId: babyId, userId: userId)
        XCTAssertEqual(plan.skipped["Meditation"], 1)
        XCTAssertTrue(plan.drafts.isEmpty)
        // The unreadable diaper and the bad date are surfaced, not invented.
        XCTAssertEqual(plan.problems.count, 2, "\(plan.problems)")
    }

    func testQuotedFieldsAndEscapedQuotesParse() {
        let rows = Huckleberry.parseCSV("a,\"b,c\",\"say \"\"hi\"\"\"\nd,e,f")
        XCTAssertEqual(rows, [["a", "b,c", "say \"hi\""], ["d", "e", "f"]])
    }
}
