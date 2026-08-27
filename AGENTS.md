<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Testing — TDD for every bug fix

The iOS app has real test suites (`ios/BeanloTests` unit, `ios/BeanloUITests`
UI flows). Rules:

- **Fixing a bug? Write the failing test FIRST.** Reproduce the reported
  behaviour in a test, watch it fail, then fix the code until it passes.
  The test stays forever so the bug can't return. No bug fix ships without
  its regression test.
- Run tests with `./scripts/test-ios.sh` (or `… unit` for the fast
  logic-only suite). UI tests need a booted iPhone simulator.
- **Every TestFlight build goes through `./scripts/ship-ios.sh`**, which
  runs the tests first and aborts on failure. Never archive/upload manually
  around it.
- New logic (predictions, clinical rules, parsers, crypto) gets unit tests
  in the same change. New screens/flows get a UI test when they stabilise.

# Web ↔ iOS: the web client is being retired

The iOS app is the product; don't build new web-client features. The
Next.js deployment still matters — the iOS app depends on its API routes
(chat/handover/notes-draft/friends/account-delete/cron-notify + APNs
sending), the invite-acceptance page, and the marketing homepage.

# TypeScript ↔ Swift ports (historical)

The iOS app (`ios/`) mirrors logic that lives in `lib/`. **If you change a
file in the left column, make the matching change in the right column** (or
regenerate it):

| Source of truth (web)   | iOS mirror                          | How it's kept in sync                          |
| ----------------------- | ----------------------------------- | ---------------------------------------------- |
| `lib/whoWeight.ts`      | `ios/SharedKit/WHOWeight.swift`     | GENERATED — run `node --experimental-strip-types scripts/gen-who-swift.mjs`; never hand-edit |
| `lib/whoGrowth.ts`      | `ios/SharedKit/WHOGrowth.swift`     | GENERATED — same script; never hand-edit       |
| `lib/predict.ts`        | `ios/Beanlo/Predict.swift`          | hand-ported — update by hand                   |
| `lib/clinical.ts`       | `ios/Beanlo/Clinical.swift`         | hand-ported — update by hand                   |
| `lib/huckleberry.ts`    | `ios/Beanlo/HuckleberryImport.swift`| hand-ported — update by hand                   |
| `lib/e2ee.ts`           | `ios/Beanlo/E2EE.swift`             | hand-ported — wire formats MUST stay interoperable (P-256 ECDH, AES-256-GCM, `{v:1, iv, ct}` envelope) |
| DB columns in `lib/types.ts` | `ios/Beanlo/Models.swift`      | hand-ported — new entry columns need both      |

Other iOS rules:

- After adding/removing Swift files, regenerate the Xcode project with
  `xcodegen` from `ios/` (spec: `ios/project.yml`) — files are not picked up
  otherwise.
- The generated WHO Swift files carry DEBUG cross-checks that assert against
  values from the TS implementation; keep those passing.
- To ship a TestFlight build, use the `ship-build` skill.
