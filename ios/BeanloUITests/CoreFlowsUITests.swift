import XCTest

/// Drives the real app in the simulator against a seeded throwaway world.
/// Run via scripts/test-ios.sh, which seeds the world, passes its session
/// tokens in as TEST_RUNNER_DEV_SESSION_AT / _RT, and tears everything down.
/// Without tokens the suite skips (so plain unit-test runs stay green).
final class CoreFlowsUITests: XCTestCase {
    private var app: XCUIApplication!

    override func setUpWithError() throws {
        let env = ProcessInfo.processInfo.environment
        guard let at = env["DEV_SESSION_AT"], let rt = env["DEV_SESSION_RT"] else {
            throw XCTSkip("No seeded session — run through scripts/test-ios.sh")
        }
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments = ["-DevSessionAT", at, "-DevSessionRT", rt]
        app.launch()
    }

    func testTodayLoadsAndEveryTabOpens() throws {
        // Today: the seeded baby's day-of-life headline renders.
        XCTAssertTrue(app.staticTexts["Juno"].waitForExistence(timeout: 20), "Today should show the baby's name")

        // Every tab opens without crashing and shows its own chrome.
        app.buttons["History"].tap()
        XCTAssertTrue(app.buttons["Calendar"].waitForExistence(timeout: 10))
        app.buttons["Charts"].tap()
        XCTAssertTrue(app.staticTexts["Feeds per day"].waitForExistence(timeout: 10))
        app.buttons["Notes"].tap()
        XCTAssertTrue(app.buttons["Add photos (optional)"].waitForExistence(timeout: 10))
        app.buttons["Friends"].tap()
        XCTAssertTrue(app.staticTexts["Add a friend"].waitForExistence(timeout: 10))
        app.buttons["Today"].tap()
    }

    func testLogAWetNappyAndSeeItInHistory() throws {
        XCTAssertTrue(app.staticTexts["Juno"].waitForExistence(timeout: 20))

        app.buttons["Log an entry"].tap()
        // Log sheet opens on nappy; wet is the default — just save.
        let save = app.buttons["Save"]
        XCTAssertTrue(save.waitForExistence(timeout: 10), "Log sheet should open")
        save.tap()
        XCTAssertTrue(save.waitForNonExistence(timeout: 10), "Sheet should dismiss after save")

        // The entry appears in History's selected-day panel.
        app.buttons["History"].tap()
        XCTAssertTrue(app.staticTexts["Wet nappy"].firstMatch.waitForExistence(timeout: 10))

        // And it can be deleted with the visible ✕ (confirming the dialog).
        app.buttons["Delete this entry"].firstMatch.tap()
        XCTAssertTrue(app.buttons["Delete"].waitForExistence(timeout: 5))
        app.buttons["Delete"].tap()
    }

    func testQuickLogFromLongPressWithUndo() throws {
        XCTAssertTrue(app.staticTexts["Juno"].waitForExistence(timeout: 20))

        app.buttons["Log an entry"].press(forDuration: 1.2)
        let wetNow = app.buttons["Wet nappy — log now"]
        XCTAssertTrue(wetNow.waitForExistence(timeout: 5), "Long-press menu should offer quick logging")
        wetNow.tap()

        // The undo toast appears — use it, leaving no data behind.
        let undo = app.buttons["Undo"]
        XCTAssertTrue(undo.waitForExistence(timeout: 10))
        undo.tap()
    }

    /// Regression: Today filtered entries with occurredAt <= a `now` that
    /// only ticked every 30s — a freshly logged dose stayed invisible.
    func testFreshlyLoggedDoseAppearsOnTodayImmediately() throws {
        XCTAssertTrue(app.staticTexts["Juno"].waitForExistence(timeout: 20))

        app.buttons["Log an entry"].press(forDuration: 1.2)
        let logMeds = app.buttons["Log meds…"]
        XCTAssertTrue(logMeds.waitForExistence(timeout: 5))
        logMeds.tap()

        let nameField = app.textFields["Medicine (e.g. Calpol)"]
        XCTAssertTrue(nameField.waitForExistence(timeout: 10))
        nameField.tap()
        nameField.typeText("Calpol")
        app.buttons["Save"].tap()

        // The dose must appear on Today at once, not after the next tick.
        XCTAssertTrue(
            app.staticTexts["Calpol"].firstMatch.waitForExistence(timeout: 6),
            "A just-logged dose should appear in Today's medicine card immediately"
        )
    }

    func testSettingsOpensFromGearAndDismisses() throws {
        XCTAssertTrue(app.staticTexts["Juno"].waitForExistence(timeout: 20))

        app.buttons["Settings"].tap()
        XCTAssertTrue(app.staticTexts["What to track"].waitForExistence(timeout: 10))
        app.buttons["Done"].tap()
        XCTAssertTrue(app.staticTexts["Juno"].waitForExistence(timeout: 10))
    }

    func testWHOChartOpensFromWeightChart() throws {
        XCTAssertTrue(app.staticTexts["Juno"].waitForExistence(timeout: 20))
        app.buttons["Charts"].tap()

        let whoButton = app.buttons["WHO chart"]
        XCTAssertTrue(whoButton.waitForExistence(timeout: 10))
        // The weight card is far down the page.
        var attempts = 0
        while !whoButton.isHittable && attempts < 10 {
            app.swipeUp()
            attempts += 1
        }
        whoButton.tap()
        XCTAssertTrue(app.staticTexts["UK-WHO weight chart"].waitForExistence(timeout: 10))
        app.buttons["Done"].tap()
    }
}
