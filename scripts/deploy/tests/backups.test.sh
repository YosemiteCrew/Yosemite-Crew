#!/usr/bin/env bash
#
# Tests for lib/backups.sh: the preflight .env copy is owner-only, and a
# successful deploy keeps only the newest few.
#
# Usage: scripts/deploy/tests/backups.test.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$HERE/../lib/backups.sh"

DEPLOY_SH="$HERE/../api-deploy.sh"
# Full-line comments blanked, line numbers kept, as in controls.test.sh: the
# guards at the bottom must see code, not the prose describing it.
DEPLOY_CODE="$(sed -E 's/^[[:space:]]*#.*$//' "$DEPLOY_SH")"

PASS=0
FAIL=0

ok() { printf '  ok   %s\n' "$1"; PASS=$((PASS + 1)); }
no() { printf '  FAIL %s\n     %s\n' "$1" "$2"; FAIL=$((FAIL + 1)); }

check() { # check <name> <expected> <actual>
  if [ "$2" = "$3" ]; then ok "$1"; else no "$1" "expected '$2', got '$3'"; fi
}

# The permission string, e.g. -rw-------. `ls` rather than `stat`, whose flags
# differ between the Linux hosts and a macOS laptop.
mode_of() { ls -ld -- "$1" | cut -c1-10; }

# The names of the files that exist among <path>..., space-separated.
names() {
  local f out=""
  for f in "$@"; do
    if [ -e "$f" ]; then out="$out ${f##*/}"; fi
  done
  printf '%s' "${out# }"
}

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# A permissive umask, so a copy that merely inherits it is visibly wrong.
umask 022

echo "deploy_backup_env"

printf 'KEY=value\n' > "$WORK/.env"
check "the source is group and world readable to begin with" "-rw-r--r--" "$(mode_of "$WORK/.env")"

deploy_backup_env "$WORK/.env" "$WORK/api-env-before-20260101-000000"
check "the copy is readable by the owner only" "-rw-------" "$(mode_of "$WORK/api-env-before-20260101-000000")"
if cmp -s "$WORK/.env" "$WORK/api-env-before-20260101-000000"; then
  ok "the copy has the same contents"
else
  no "the copy has the same contents" "contents differ"
fi
check "the caller's umask is left alone" "0022" "$(umask)"

rc=0
deploy_backup_env "$WORK/missing.env" "$WORK/api-env-before-20260101-000001" || rc=$?
check "a missing .env does not stop the deploy" "0" "$rc"
if [ -e "$WORK/api-env-before-20260101-000001" ]; then
  no "a missing .env writes no copy" "a copy was written"
else
  ok "a missing .env writes no copy"
fi

echo "deploy_prune_backups"

PRUNE="$WORK/prune"
mkdir "$PRUNE"
# Written out of order on purpose: the stamp in the name decides which are
# newest, not the order the files happened to be created in.
for stamp in 20260103-000000 20260105-000000 20260101-000000 20260104-000000 20260102-000000; do
  printf 'KEY=%s\n' "$stamp" > "$PRUNE/api-env-before-$stamp"
done
# Other backups sharing the directory are not this function's to remove.
printf 'x' > "$PRUNE/api-dist-before-20260101-000000.tgz"
printf 'x' > "$PRUNE/api-rollback-20260101-000000.txt"

deploy_prune_backups "$PRUNE/api-env-before-" 3
check "only the newest three are kept" \
  "api-env-before-20260103-000000 api-env-before-20260104-000000 api-env-before-20260105-000000" \
  "$(names "$PRUNE"/api-env-before-*)"
check "copies kept from before are made owner-only too" \
  "-rw------- -rw------- -rw-------" \
  "$(for f in "$PRUNE"/api-env-before-*; do mode_of "$f"; done | tr '\n' ' ' | sed 's/ $//')"
check "files with another prefix are left alone" \
  "api-dist-before-20260101-000000.tgz api-rollback-20260101-000000.txt" \
  "$(names "$PRUNE"/api-dist-before-* "$PRUNE"/api-rollback-*)"
check "their modes are left alone" "-rw-r--r--" "$(mode_of "$PRUNE/api-dist-before-20260101-000000.tgz")"

FEW="$WORK/few"
mkdir "$FEW"
printf 'x' > "$FEW/api-env-before-20260101-000000"
printf 'x' > "$FEW/api-env-before-20260102-000000"
deploy_prune_backups "$FEW/api-env-before-" 3
check "fewer than three: nothing is removed" \
  "api-env-before-20260101-000000 api-env-before-20260102-000000" \
  "$(names "$FEW"/*)"

rc=0
err="$(deploy_prune_backups "$WORK/nothing-here/api-env-before-" 3 2>&1 >/dev/null)" || rc=$?
check "no backups at all is not an error" "0" "$rc"
# The unmatched glob comes back as the pattern itself; it must not reach rm or
# chmod and print an error into the deploy log.
check "no backups at all prints nothing" "" "$err"

echo "api-deploy.sh"

line_of() { grep -n -m1 -F -- "$1" <<< "$DEPLOY_CODE" | cut -d: -f1 || true; }

if grep -qE '^for helper in .*[[:space:]]backups([[:space:];]|$)' <<< "$DEPLOY_CODE"; then
  ok "the deploy refuses to start without lib/backups.sh"
else
  no "the deploy refuses to start without lib/backups.sh" "backups missing from the helper list"
fi

if grep -qE '(^|[[:space:];&|])cp [^|;&]*apps/backend/\.env' <<< "$DEPLOY_CODE"; then
  no "the .env is copied only through deploy_backup_env" "a bare cp of apps/backend/.env is still there"
else
  ok "the .env is copied only through deploy_backup_env"
fi

BACKUP_LINE="$(line_of 'deploy_backup_env apps/backend/.env "${ENV_BACKUP_PREFIX}$STAMP"')"
RECORD_LINE="$(line_of 'deploy_record_deployed_sha "$DEPLOYED_SHA_RECORD"')"
PRUNE_LINE="$(line_of 'deploy_prune_backups "$ENV_BACKUP_PREFIX" 3')"
if [ -n "$BACKUP_LINE" ]; then
  ok "preflight writes the .env copy through deploy_backup_env"
else
  no "preflight writes the .env copy through deploy_backup_env" "call not found"
fi
if [ -n "$RECORD_LINE" ] && [ -n "$PRUNE_LINE" ] && [ "$RECORD_LINE" -lt "$PRUNE_LINE" ]; then
  ok "old copies are pruned only after a verified cutover, keeping three"
else
  no "old copies are pruned only after a verified cutover, keeping three" \
     "record=$RECORD_LINE prune=$PRUNE_LINE"
fi
check "the copy and the prune use the same prefix" \
  'ENV_BACKUP_PREFIX="/tmp/api-env-before-"' \
  "$(grep -m1 -E '^ENV_BACKUP_PREFIX=' <<< "$DEPLOY_CODE" || true)"

echo
printf '%s passed, %s failed\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
