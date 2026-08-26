<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Web ↔ iOS: TypeScript is the source of truth

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
