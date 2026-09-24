#!/usr/bin/env bash
#
# The preflight copy of apps/backend/.env that api-deploy.sh keeps next to the
# rollback sha: who can read it, and how many are kept. Also the directory the
# deploy scripts and those files live in.
#
# Extracted so both rules are tested rather than only being found on a live
# box, the same reason the other files in lib/ exist.

# deploy_backup_env <env-file> <backup-path>
#
# Copies <env-file> to <backup-path>, readable by the owner only. Never fails:
# a box with no .env still deploys, exactly as it did before this existed.
#
# The copy is always a new file made here: mktemp creates it owner-only, and ln
# gives it <backup-path> only if that name is still free. Whatever is already
# at <backup-path> is left as it is, and no copy is written.
deploy_backup_env() {
  local src="${1:?env file required}"
  local dest="${2:?backup path required}"
  local tmp

  tmp="$(mktemp "$dest.XXXXXX" 2>/dev/null)" || return 0
  if cp -- "$src" "$tmp" 2>/dev/null; then
    ln -- "$tmp" "$dest" 2>/dev/null || true
  fi
  rm -f -- "$tmp"
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

# deploy_private_dir <dir>
#
# Creates <dir> if it is missing and makes it owner-only. Fails, saying why,
# unless <dir> is a real directory (not a link) owned by this user.
deploy_private_dir() {
  local dir="${1:?directory required}"

  if [ ! -e "$dir" ]; then
    mkdir -m 700 -- "$dir" || return 1
  fi
  if [ -L "$dir" ] || [ ! -d "$dir" ] || [ ! -O "$dir" ]; then
    echo "$dir must be a directory owned by this user, not a link" >&2
    return 1
  fi
  chmod 700 "$dir"
}

# deploy_prepare_stage <root>
#
# Readies the deploy directory: <root> keeps the deploy's files between runs,
# and <root>/scripts, where the workflow copies scripts/deploy, starts empty.
deploy_prepare_stage() {
  local root="${1:?deploy directory required}"

  deploy_private_dir "$root" || return 1
  rm -rf -- "$root/scripts"
  deploy_private_dir "$root/scripts"
}
