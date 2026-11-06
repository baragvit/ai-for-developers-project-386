#!/usr/bin/env bash
# Proves the conflict API tests guard the no-overlap rule: disables the overlap check with a patch,
# runs only those tests and succeeds only if the expected ones fail. The patch is always reverted.
set -euo pipefail

root=$(git rev-parse --show-toplevel)
dir="$root/scripts/rule-guard"
patch="$dir/disable-overlap-check.patch"
target=backend/src/domain/model.ts
test_file=test/booking-conflicts.test.ts

cd "$root"

if ! git apply --check "$patch"; then
  echo "rule-guard: $patch no longer applies to $target; update the patch to the current code." >&2
  exit 1
fi

before=$(git hash-object "$target")
report=$(mktemp)
applied=0

restore() {
  local code=$?
  if [ "$applied" = 1 ]; then
    git apply -R "$patch" || code=1
    if [ "$(git hash-object "$target")" != "$before" ]; then
      echo "rule-guard: $target was not restored." >&2
      code=1
    fi
  fi
  rm -f "$report"
  exit "$code"
}
trap restore EXIT
trap 'exit 130' INT TERM

git apply "$patch"
applied=1
echo "rule-guard: overlap check disabled, running $test_file (failures below are expected)"

(cd backend && npx vitest run "$test_file" --reporter=default --reporter=json --outputFile.json="$report") || true

node "$dir/verify.mjs" "$report" "$dir/expected-failures.txt" "$test_file"
