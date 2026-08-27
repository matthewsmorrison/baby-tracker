---
name: ship-build
description: Archive the iOS app, export a signed IPA, and upload it to TestFlight via App Store Connect. Use when the user says "ship a new build", "push to TestFlight", or similar.
---

# Ship a new TestFlight build

Builds beanlo for iOS, signs it, and uploads to App Store Connect. Testers on
internal groups get it automatically once Apple finishes processing (~10–30 min).

## Prerequisites (already set up — verify only if a step fails)

- Paid team `DZ9VAB947K` signed into Xcode (Settings → Accounts, ewmo11@gmail.com).
- App Store Connect API key `AuthKey_2XVZ5U8275.p8` in `~/.appstoreconnect/private_keys/`
  (issuer `93f22c36-dfcf-4d70-8980-2309f2712564`). This key CANNOT cloud-sign —
  it is upload-only. Signing always goes through the Xcode account session.
- App record "beanlo" (`io.beanlo`) exists in App Store Connect.

## Steps

Run everything from `ios/`. Use a scratch directory for build products.

0. **Run the tests first**: `./scripts/test-ios.sh unit` from the repo root
   (full `./scripts/test-ios.sh` if app flows changed — see the test-ios
   skill). Don't ship a build with failing tests.

1. **Bump the build number.** In `ios/project.yml`, increment
   `CURRENT_PROJECT_VERSION` in **both** targets (Beanlo and BeanloWidgets —
   they must match or App Store validation fails). Bump `MARKETING_VERSION`
   only for a user-visible release. Then regenerate:

   ```sh
   xcodegen   # the standalone binary; install location may vary per machine
   ```

2. **Archive** (Release, signed via the Xcode session):

   ```sh
   xcodebuild archive -project Beanlo.xcodeproj -scheme Beanlo \
     -destination 'generic/platform=iOS' \
     -archivePath "$SCRATCH/beanlo.xcarchive" -allowProvisioningUpdates -quiet
   ```

3. **Export the IPA** using the `ExportOptions.plist` next to this skill.
   Do NOT pass `-authenticationKey*` flags here — the API key's role can't
   create distribution certificates ("Cloud signing permission error"):

   ```sh
   xcodebuild -exportArchive -archivePath "$SCRATCH/beanlo.xcarchive" \
     -exportOptionsPlist .claude/skills/ship-build/ExportOptions.plist \
     -exportPath "$SCRATCH/export" -allowProvisioningUpdates
   ```

4. **Upload** with the API key:

   ```sh
   xcrun altool --upload-app -f "$SCRATCH/export/Beanlo.ipa" -t ios \
     --apiKey 2XVZ5U8275 --apiIssuer 93f22c36-dfcf-4d70-8980-2309f2712564
   ```

   Success looks like `UPLOAD SUCCEEDED` with a Delivery UUID.

5. **Commit** the version bump (`ios/project.yml` + regenerated
   `project.pbxproj`) and push. Do not poll App Store Connect for
   processing status — report the upload result and stop.

## Failure notes

- "No suitable application records found" → the bundle ID doesn't match an
  app record in App Store Connect; check `io.beanlo` exists there.
- "Cloud signing permission error" → an API key was passed to
  `-exportArchive`; remove it (see step 3).
- Redundant build number → step 1 was skipped; `manageAppVersionAndBuildNumber`
  in the export options usually auto-fixes this, but keep the repo truthful.
