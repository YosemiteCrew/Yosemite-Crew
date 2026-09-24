#!/usr/bin/env bash
#
# Tests for lib/backups.sh: the preflight .env copy is owner-only, a successful
# deploy keeps only the newest few, and the deploy directory is owner-only.
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
# differ between GNU and BSD.
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

# A name that is already taken is left alone: an existing file is not written
# into, and a link is not followed.
printf 'OLD\n' > "$WORK/api-env-before-20260101-000002"
deploy_backup_env "$WORK/.env" "$WORK/api-env-before-20260101-000002"
check "a file already at the backup path is not written into" "OLD" \
  "$(cat "$WORK/api-env-before-20260101-000002")"

ln -s "$WORK/link-target" "$WORK/api-env-before-20260101-000003"
deploy_backup_env "$WORK/.env" "$WORK/api-env-before-20260101-000003"
if [ -e "$WORK/link-target" ]; then
  no "a link at the backup path is not followed" "the copy was written through the link"
else
  ok "a link at the backup path is not followed"
fi

check "no working copies are left behind" "" "$(names "$WORK"/api-env-before-*.*)"

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

echo "deploy_private_dir"

# Captures a call's status and stderr without letting set -e end the suite.
run() { # run <function> <args...>; sets RC and ERR
  RC=0
  ERR="$("$@" 2>&1 >/dev/null)" || RC=$?
}

run deploy_private_dir "$WORK/private"
check "a missing directory is created" "0" "$RC"
check "and is readable by the owner only" "drwx------" "$(mode_of "$WORK/private")"

mkdir -m 755 "$WORK/open"
run deploy_private_dir "$WORK/open"
check "an existing directory is made owner-only" "0 drwx------" "$RC $(mode_of "$WORK/open")"

mkdir -m 755 "$WORK/link-target-dir"
ln -s "$WORK/link-target-dir" "$WORK/linked-dir"
run deploy_private_dir "$WORK/linked-dir"
check "a link to a directory is refused" "1" "$RC"
check "and says why" "$WORK/linked-dir must be a directory owned by this user, not a link" "$ERR"
check "and the directory it points to is left alone" "drwxr-xr-x" "$(mode_of "$WORK/link-target-dir")"

printf 'x' > "$WORK/a-file"
run deploy_private_dir "$WORK/a-file"
check "a file is refused" "1 -rw-r--r--" "$RC $(mode_of "$WORK/a-file")"

# The root directory stands in for one owned by someone else. Skipped as root,
# where it would be owned by this user.
if [ "$(id -u)" != "0" ]; then
  run deploy_private_dir /
  check "a directory owned by another user is refused" \
    "1 / must be a directory owned by this user, not a link" "$RC $ERR"
fi

echo "deploy_prepare_stage"

STAGE="$WORK/stage"
run deploy_prepare_stage "$STAGE"
check "the deploy directory and its scripts directory are owner-only" \
  "0 drwx------ drwx------" "$RC $(mode_of "$STAGE") $(mode_of "$STAGE/scripts")"

printf 'old\n' > "$STAGE/scripts/api-deploy.sh"
printf 'kept\n' > "$STAGE/api-deployed-sha.txt"
run deploy_prepare_stage "$STAGE"
check "the scripts directory starts empty on every run" "0 " "$RC $(names "$STAGE"/scripts/*)"
check "files kept between runs are left alone" "kept" "$(cat "$STAGE/api-deployed-sha.txt")"

mkdir "$WORK/elsewhere"
printf 'x' > "$WORK/elsewhere/keep"
rm -rf "$STAGE/scripts"
ln -s "$WORK/elsewhere" "$STAGE/scripts"
run deploy_prepare_stage "$STAGE"
check "a link in place of the scripts directory is replaced by a directory" \
  "0 drwx------" "$RC $(mode_of "$STAGE/scripts")"
check "and what it pointed to is left alone" "keep" "$(names "$WORK"/elsewhere/*)"

mkdir -p "$WORK/other-root/scripts"
printf 'x' > "$WORK/other-root/scripts/keep"
ln -s "$WORK/other-root" "$WORK/linked-root"
run deploy_prepare_stage "$WORK/linked-root"
check "a link in place of the deploy directory is refused" "1" "$RC"
check "and nothing behind it is removed" "keep" "$(names "$WORK"/other-root/scripts/*)"

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
  'ENV_BACKUP_PREFIX="$DEPLOY_STATE_DIR/api-env-before-"' \
  "$(grep -m1 -E '^ENV_BACKUP_PREFIX=' <<< "$DEPLOY_CODE" || true)"

LEGACY_PRUNE_LINE="$(line_of 'deploy_prune_backups /tmp/api-env-before- 0')"
if [ -n "$RECORD_LINE" ] && [ -n "$LEGACY_PRUNE_LINE" ] && [ "$RECORD_LINE" -lt "$LEGACY_PRUNE_LINE" ]; then
  ok "copies left in /tmp by older versions are removed after a verified cutover"
else
  no "copies left in /tmp by older versions are removed after a verified cutover" \
     "record=$RECORD_LINE legacy prune=$LEGACY_PRUNE_LINE"
fi

check "the deploy keeps its files in a directory in the home directory" \
  'DEPLOY_STATE_DIR="$HOME/.yc-deploy"' \
  "$(grep -m1 -E '^DEPLOY_STATE_DIR=' <<< "$DEPLOY_CODE" || true)"

PRIVATE_LINE="$(grep -n -m1 -x 'deploy_private_dir "$DEPLOY_STATE_DIR"' <<< "$DEPLOY_CODE" | cut -d: -f1 || true)"
FIRST_USE_LINE="$(grep -n -m1 -F '$DEPLOY_STATE_DIR/' <<< "$DEPLOY_CODE" | cut -d: -f1 || true)"
if [ -n "$PRIVATE_LINE" ] && [ -n "$FIRST_USE_LINE" ] && [ "$PRIVATE_LINE" -lt "$FIRST_USE_LINE" ]; then
  ok "that directory is checked before anything is written to it"
else
  no "that directory is checked before anything is written to it" \
     "check=$PRIVATE_LINE first use=$FIRST_USE_LINE"
fi

# Only the two old names are left, and those are read or removed, never written.
check "nothing else in the deploy names /tmp" "" \
  "$(grep -F '/tmp' <<< "$DEPLOY_CODE" \
     | grep -vxF -e 'deploy_adopt_legacy_record "$DEPLOYED_SHA_RECORD" /tmp/api-deployed-sha.txt' \
                  -e 'deploy_prune_backups /tmp/api-env-before- 0 || echo "  could not remove old .env backups from /tmp" >&2' \
     || true)"

echo "deploy-api.yml"

WORKFLOW="$HERE/../../../.github/workflows/deploy-api.yml"
workflow_has() { # workflow_has <name> <fixed-string>
  if grep -qF -- "$2" "$WORKFLOW"; then ok "$1"; else no "$1" "not found: $2"; fi
}
workflow_has "the workflow sets the directory up on the host" \
  '{ cat scripts/deploy/lib/backups.sh; echo "deploy_prepare_stage \"\$HOME/.yc-deploy\""; }'
workflow_has "the workflow copies the scripts into it" \
  'scripts/deploy/. "$DEPLOY_USER@$HOST:.yc-deploy/scripts/"'
workflow_has "the workflow runs the copy it made" \
  "\\\$HOME/.yc-deploy/scripts/api-deploy.sh '"
check "the workflow does not use /tmp" "0" "$(grep -c '/tmp' "$WORKFLOW" || true)"

# The deploy target comes from the environment, never from this file.
for name in API_HOST API_DEPLOY_USER API_REPO_DIR API_PROCESS; do
  workflow_has "the workflow reads $name from the environment" "\${{ secrets.$name }}"
done
workflow_has "the workflow refuses to deploy with a target value missing" \
  'for name in API_HOST API_DEPLOY_USER API_REPO_DIR API_PROCESS; do'
check "the workflow names no IPv4 host" "" \
  "$(grep -oE '\b([0-9]{1,3}\.){3}[0-9]{1,3}\b' "$WORKFLOW" || true)"
check "the workflow names no home-directory checkout" "0" "$(grep -c '/home/' "$WORKFLOW" || true)"
check "every ssh and scp target is the configured deploy user" "" \
  "$(grep -oE '"[A-Za-z0-9_$.-]*@\$HOST' "$WORKFLOW" | grep -vxF '"$DEPLOY_USER@$HOST' || true)"

echo
printf '%s passed, %s failed\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
