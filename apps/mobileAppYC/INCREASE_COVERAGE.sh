#!/bin/bash
# Auto-coverage increase script
# Run: bash INCREASE_COVERAGE.sh

cd /Users/harshitwandhare/Desktop/Yosemite-Crew/apps/mobileAppYC

echo "=== CURRENT COVERAGE ==="
npm run test -- --coverage --coverageReporters=text 2>&1 | grep "All files"

echo ""
echo "=== FILES UNDER 30% COVERAGE (YOUR TARGETS) ==="
npm run test -- --coverage --coverageReporters=text 2>&1 | grep -E "^\s+[A-Za-z].*\.(tsx|ts)\s+\|" | awk -F'|' '$2+0 < 30 && $2+0 > 0' | head -20

echo ""
echo "=== TESTS STATUS ==="
npm run test 2>&1 | grep -E "Test Suites:|Tests:"
