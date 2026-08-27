#!/bin/bash
# Ship a TestFlight build — tests ALWAYS run first and a failure aborts.
#
#   ./scripts/ship-ios.sh            # unit tests → bump → archive → upload
#   FULL_TESTS=1 ./scripts/ship-ios.sh   # run UI tests too before shipping
#   DRY_RUN=1 ./scripts/ship-ios.sh      # tests + archive only, no bump/upload
set -euo pipefail
cd "$(dirname "$0")/.."

API_KEY_ID="2XVZ5U8275"
API_ISSUER="93f22c36-dfcf-4d70-8980-2309f2712564"
SCRATCH="${TMPDIR:-/tmp}/beanlo-ship"
EXPORT_PLIST=".claude/skills/ship-build/ExportOptions.plist"

# xcodegen: PATH first, then the standalone copy in ~/bin.
XCODEGEN=$(command -v xcodegen || ls "$HOME/bin/xcodegen" 2>/dev/null || true)
if [ -z "$XCODEGEN" ]; then
  echo "xcodegen not found — brew install xcodegen (or restore ~/bin/xcodegen)" >&2
  exit 1
fi

# ---- 1. Tests gate the build. No green, no ship. ----
if [ "${FULL_TESTS:-0}" = "1" ]; then
  ./scripts/test-ios.sh
else
  ./scripts/test-ios.sh unit
fi

# ---- 2. Bump the build number (both targets stay in lockstep). ----
if [ "${DRY_RUN:-0}" != "1" ]; then
  CURRENT=$(grep -m1 'CURRENT_PROJECT_VERSION:' ios/project.yml | grep -o '[0-9]*')
  NEXT=$((CURRENT + 1))
  sed -i '' "s/CURRENT_PROJECT_VERSION: $CURRENT/CURRENT_PROJECT_VERSION: $NEXT/g" ios/project.yml
  echo "Build number: $CURRENT → $NEXT"
fi
(cd ios && "$XCODEGEN" >/dev/null)

# ---- 3. Archive (signed via the Xcode session) and export. ----
rm -rf "$SCRATCH"
xcodebuild archive -project ios/Beanlo.xcodeproj -scheme Beanlo \
  -destination 'generic/platform=iOS' \
  -archivePath "$SCRATCH/beanlo.xcarchive" -allowProvisioningUpdates -quiet
# NOTE: no API-key flags here — the upload key can't cloud-sign.
xcodebuild -exportArchive -archivePath "$SCRATCH/beanlo.xcarchive" \
  -exportOptionsPlist "$EXPORT_PLIST" \
  -exportPath "$SCRATCH/export" -allowProvisioningUpdates | tail -1

if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "DRY RUN — skipping upload. IPA at $SCRATCH/export/Beanlo.ipa"
  exit 0
fi

# ---- 4. Upload. ----
xcrun altool --upload-app -f "$SCRATCH/export/Beanlo.ipa" -t ios \
  --apiKey "$API_KEY_ID" --apiIssuer "$API_ISSUER" 2>&1 | grep -E "UPLOAD|Delivery|ERROR" || true

echo "Shipped build $NEXT — commit the version bump (ios/project.yml + project.pbxproj)."
