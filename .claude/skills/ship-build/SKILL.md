---
name: ship-build
description: Ship a new TestFlight build. Tests run first automatically and a failure aborts the ship. Use when the user says "ship a new build", "push to TestFlight", or similar.
---

# Ship a new TestFlight build

One command does everything — from the repo root:

```sh
./scripts/ship-ios.sh                 # unit tests → bump build number → archive → upload
FULL_TESTS=1 ./scripts/ship-ios.sh    # UI tests too (use when app flows changed)
DRY_RUN=1 ./scripts/ship-ios.sh       # tests + archive only; no bump, no upload
```

The tests are a hard gate baked into the script — if they fail, nothing is
built or uploaded. Do not bypass the script to ship manually.

After a successful ship: **commit the version bump** (`ios/project.yml` +
regenerated `project.pbxproj`) with a message describing what the build
contains. Do not poll App Store Connect for processing status — report the
upload result and stop. Testers receive the build automatically ~10–30 min
later.

## Prerequisites (already set up — check only if the script fails)

- Paid team `DZ9VAB947K` signed into Xcode (Settings → Accounts, ewmo11@gmail.com).
- App Store Connect API key `AuthKey_2XVZ5U8275.p8` in `~/.appstoreconnect/private_keys/`.
  This key is upload-only — it cannot cloud-sign, which is why the script
  never passes it to the archive/export steps ("Cloud signing permission
  error" means someone did).
- App record "beanlo" (`io.beanlo`) in App Store Connect.
- xcodegen on PATH (`brew install xcodegen`) or in the session scratchpad.

## Failure notes

- Tests failed → fix the code (see the test-ios skill and the TDD rule in
  AGENTS.md), never ship around them.
- "No suitable application records found" → bundle ID mismatch in App Store
  Connect.
- Redundant build number → the export options' manageAppVersionAndBuildNumber
  usually auto-heals this; keep ios/project.yml truthful regardless.
