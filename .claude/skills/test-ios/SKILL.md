---
name: test-ios
description: Run the iOS test suites — unit tests for the clinical/prediction/E2EE/import logic, and UI tests that drive the real app in the simulator against a seeded throwaway world. Use when the user says "run the tests", before shipping a build, or after changing iOS logic.
---

# Run the iOS tests

Everything is wrapped in one script (run from the repo root):

```sh
./scripts/test-ios.sh          # unit + UI tests (seeds + tears down a test world)
./scripts/test-ios.sh unit     # unit tests only — fast, no network, no seeding
```

## What runs

- **BeanloTests** (unit, app-hosted): FeedTimerState, Clinical guidance
  (nappy quotas, stool colours, weight bands), Predict (feed rhythm, nap
  windows, backtesting), WHO tables + centile inversion, E2EE round-trip /
  tamper / ECDH agreement, Huckleberry CSV parsing.
- **BeanloUITests** (XCUITest, simulator): launches the real app with a
  seeded session and taps through the core flows — tabs render, log a
  nappy and see/delete it in History, long-press quick log + Undo,
  Settings sheet, WHO chart. Skips itself when no session env is present.

## Mechanics to know

- The UI world is a throwaway user + baby ("Juno") seeded into production
  Supabase by `scripts/ios-test-seed.mjs` and ALWAYS deleted by
  `scripts/ios-test-teardown.mjs` (the script traps EXIT). If a run dies
  hard, check `ios/build/test-session.json` and run the teardown manually.
- Session tokens reach the UI tests via `TEST_RUNNER_DEV_SESSION_AT/_RT`
  **environment variables** — as xcodebuild arguments they are silently
  ignored and every UI test skips.
- A booted iPhone simulator is required (`xcrun simctl boot "iPhone 17 Pro"`).
- New UI tests: prefer accessibility labels that already exist in the app;
  segmented-control options are `buttons`, not `staticTexts`.

Run `./scripts/test-ios.sh unit` before every `ship-build` at minimum; the
full suite when app flows changed.
