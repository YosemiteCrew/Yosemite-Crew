#!/usr/bin/env bash
#
# The preflight copy of apps/backend/.env that api-deploy.sh keeps next to the
# rollback sha: who can read it, and how many are kept.
#
# Extracted so both rules are tested rather than only being found on a live
# box, the same reason the other files in lib/ exist.

# deploy_backup_env <env-file> <backup-path>
#
# Copies <env-file> to <backup-path>, readable by the owner only. Never fails:
# a box with no .env still deploys, exactly as it did before this existed.
#
# The umask rather than a chmod afterwards, so the copy is created owner-only
# instead of being tightened once it already exists.
deploy_backup_env() {
  local src="${1:?env file required}"
  local dest="${2:?backup path required}"

  ( umask 077 && cp -- "$src" "$dest" ) 2>/dev/null || true
}

# deploy_prune_backups <path-prefix> <keep>
#
# Keeps the newest <keep> files whose path starts with <path-prefix>, removes
# the rest, and makes the ones it keeps owner-only as well, so copies written
# before deploy_backup_env existed are tightened on the next deploy rather than
# lingering. Newest by NAME: the prefix is followed by a %Y%m%d-%H%M%S stamp,
# which sorts chronologically, and glob expansion is sorted.
#
# Called only after a verified cutover. A deploy that stops keeps every copy,
# because the one it just wrote is the one a rollback would want.
deploy_prune_backups() {
  local prefix="${1:?backup path prefix required}"
  local keep="${2:?number of backups to keep required}"
  local files=()
  local f

  for f in "$prefix"*; do
    if [ -f "$f" ]; then files+=("$f"); fi
  done

  local count="${#files[@]}"
  local i=0
  while [ "$i" -lt "$count" ]; do
    if [ "$i" -lt "$((count - keep))" ]; then
      rm -f -- "${files[$i]}"
    else
      chmod go-rwx "${files[$i]}"
    fi
    i=$((i + 1))
  done
}
