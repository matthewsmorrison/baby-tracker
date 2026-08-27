#!/bin/bash
# Full iOS test run: unit tests (pure logic, no network), then UI tests
# driving the real app in the simulator against a seeded throwaway world
# in production Supabase (created before, ALWAYS deleted after).
#
#   ./scripts/test-ios.sh          # everything
#   ./scripts/test-ios.sh unit     # unit tests only (fast, no seeding)
set -euo pipefail
cd "$(dirname "$0")/.."

DEST=${DEST:-"platform=iOS Simulator,name=iPhone 17 Pro"}
MODE=${1:-all}

if [ "$MODE" = "unit" ]; then
  xcodebuild test -project ios/Beanlo.xcodeproj -scheme Beanlo \
    -destination "$DEST" -only-testing:BeanloTests -quiet
  echo "UNIT-TESTS-PASSED"
  exit 0
fi

echo "Seeding throwaway test world…"
node scripts/ios-test-seed.mjs

cleanup() {
  echo "Tearing down test world…"
  node scripts/ios-test-teardown.mjs || echo "WARNING: teardown failed — delete ios/build/test-session.json world manually"
}
trap cleanup EXIT

AT=$(node -e "console.log(JSON.parse(require('fs').readFileSync('ios/build/test-session.json')).accessToken)")
RT=$(node -e "console.log(JSON.parse(require('fs').readFileSync('ios/build/test-session.json')).refreshToken)")

# TEST_RUNNER_-prefixed *environment* variables reach the test process
# (as build-setting arguments they'd be silently ignored).
TEST_RUNNER_DEV_SESSION_AT="$AT" TEST_RUNNER_DEV_SESSION_RT="$RT" \
  xcodebuild test -project ios/Beanlo.xcodeproj -scheme Beanlo \
  -destination "$DEST" -quiet

echo "ALL-TESTS-PASSED"
