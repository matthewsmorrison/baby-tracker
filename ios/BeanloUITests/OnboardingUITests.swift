import XCTest

/// Walks the ENTIRE new-user onboarding with a baby-less seeded account:
/// welcome → name → birth → weight → sex → tracking → rhythm → create →
/// alerts (skipped, so no permission dialog) → invite (skipped) → main app.
/// Exists because the create step once failed in production while every
/// earlier screen looked fine — the flow must be walked to its end.
final class OnboardingUITests: XCTestCase {
    private var app: XCUIApplication!

    override func setUpWithError() throws {
        let env = ProcessInfo.processInfo.environment
        guard let at = env["DEV_ONBOARD_AT"], let rt = env["DEV_ONBOARD_RT"] else {
            throw XCTSkip("No baby-less seeded session — run through scripts/test-ios.sh")
        }
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments = ["-DevSessionAT", at, "-DevSessionRT", rt]
        app.launch()
    }

    func testFullOnboardingCreatesTheBaby() throws {
        // Welcome
        XCTAssertTrue(app.staticTexts["Welcome to Beanlo"].waitForExistence(timeout: 20))
        app.buttons["Let's set up"].tap()

        // Name (field is auto-focused)
        let nameField = app.textFields["Name"]
        XCTAssertTrue(nameField.waitForExistence(timeout: 10))
        nameField.typeText("Pip")
        dismissKeyboard()
        tapContinue()

        // Birth — the default (3 days ago) is valid.
        XCTAssertTrue(app.staticTexts["When was Pip born?"].waitForExistence(timeout: 10))
        tapContinue()

        // Weight in kg
        let kgField = app.textFields["3.42"]
        XCTAssertTrue(kgField.waitForExistence(timeout: 10))
        kgField.tap()
        kgField.typeText("3.42")
        dismissKeyboard()
        tapContinue()

        // Sex
        XCTAssertTrue(app.buttons["Boy"].waitForExistence(timeout: 10))
        app.buttons["Boy"].tap()
        tapContinue()

        // Tracking — defaults are fine.
        XCTAssertTrue(app.staticTexts["What do you want to track?"].waitForExistence(timeout: 10))
        tapContinue()

        // Rhythm → THE step that once failed: creating the baby through RLS.
        XCTAssertTrue(app.staticTexts["How often are you aiming to feed?"].waitForExistence(timeout: 10))
        app.buttons["Create Pip's tracker"].tap()

        // Alerts prime — skip so no system permission dialog blocks the test.
        let notNow = app.buttons["Not now"]
        XCTAssertTrue(
            notNow.waitForExistence(timeout: 15),
            "Baby creation should succeed and advance to the alerts step"
        )
        notNow.tap()

        // Invite — skip.
        let later = app.buttons["I'll do this later"]
        XCTAssertTrue(later.waitForExistence(timeout: 10))
        later.tap()

        // The main app loads with the new baby.
        XCTAssertTrue(
            app.staticTexts["Pip"].waitForExistence(timeout: 20),
            "After onboarding the Today screen should show the new baby"
        )
        XCTAssertTrue(app.buttons["History"].exists)
    }

    private func tapContinue() {
        let button = app.buttons["Continue"]
        XCTAssertTrue(button.waitForExistence(timeout: 10))
        button.tap()
    }

    private func dismissKeyboard() {
        // The flow scrolls with .interactively keyboard dismissal.
        app.swipeDown()
    }
}
