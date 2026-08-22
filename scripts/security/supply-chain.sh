#!/usr/bin/env bash
# Supply-chain security tooling: SBOM generation, vulnerability scanning, and
# license compliance (#1721). CI (.github/workflows/supply-chain.yml) invokes
# THIS script, so the local commands and the gate are the same thing by
# construction - if it passes here, it passes there.
#
# Usage:
#   scripts/security/supply-chain.sh sbom       # SPDX + CycloneDX into security/sbom/
#   scripts/security/supply-chain.sh scan       # grype over the SBOM, fails on critical
#   scripts/security/supply-chain.sh licenses   # grant over the SBOM, AGPL policy
#   scripts/security/supply-chain.sh all        # the three in order
#
# Or via pnpm: security:sbom / security:scan / security:licenses / security:all
set -euo pipefail

# Single source of truth for tool versions. CI uses the same pins because it
# runs this script; bump them here AND refresh the digest table below.
SYFT_VERSION="v1.50.0"
GRYPE_VERSION="v0.116.1"
GRANT_VERSION="v0.6.8"

# Repository-pinned sha256 digests for every release tarball we install, so
# verification does not depend on files served alongside the artifact (a
# compromised upstream release could replace both the tarball and its
# checksums file; it cannot rewrite this table). Refresh when bumping a
# version - the new digests come from the release's checksums file and are
# then reviewed here like any code change.
pinned_digest() {
  case "$1" in
    syft_darwin_amd64) echo "d11a8c7bc27114853bd7c1e1b2f3be3ddda3a1de17aee585329f04c369341c75" ;;
    syft_darwin_arm64) echo "e32fdb9d47823fa633748a1efca2528fd77c37469ea93c9e40ab835da44e4cce" ;;
    syft_linux_amd64) echo "bf7b29ff57f06da30918266a0e1c2885a8f99784798d1bdb1628886aa015d788" ;;
    syft_linux_arm64) echo "887c57cbcc2d0e8c5c110a4571a3fc7150058b24d74f993ee4663516e5c8ce86" ;;
    grype_darwin_amd64) echo "e5ff3adac317511876de7863598587a7dbab0c47c8e150368b7df06909c11f4e" ;;
    grype_darwin_arm64) echo "f493f169cbaae48bade169532b20235fc16653d2a044a5bc6fe6f69a3923f975" ;;
    grype_linux_amd64) echo "0122df7b655981abe547ad3d2190d65551dac6a2bfc80b4dc2a989b5d0587458" ;;
    grype_linux_arm64) echo "a8d7504a149629324eb5f4ce3dc25dfd211bbfe047e64ee2bf7844b466c3d84d" ;;
    grant_darwin_amd64) echo "e8b2b3b3666ef4bb3731d0399485215258f8c205ab30f1557b9b51b34b8bd44c" ;;
    grant_darwin_arm64) echo "3d8f315f4f27d9efc8fc712ee27f10cd0df64ac794226580ea5346234f2d6806" ;;
    grant_linux_amd64) echo "6500f8bbf0f20fb993de8084686e199f0ba1eb494769ff75454286d5ef63f919" ;;
    grant_linux_arm64) echo "15ec0b4346a64b5580958dc62c4e7c25ca9e59b7582bab9706679f6b9d2288b8" ;;
    *) echo "" ;;
  esac
}

# SUPPLY_CHAIN_REPO_ROOT is a test hook; everything real derives the root from
# the script's own location.
REPO_ROOT="${SUPPLY_CHAIN_REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
TOOL_DIR="${REPO_ROOT}/.security-tools/bin"
SBOM_DIR="${REPO_ROOT}/security/sbom"
REPORT_DIR="${REPO_ROOT}/security/reports"
CDX_SBOM="${SBOM_DIR}/yosemite-crew.cdx.json"
SPDX_SBOM="${SBOM_DIR}/yosemite-crew.spdx.json"

mkdir -p "${TOOL_DIR}" "${SBOM_DIR}" "${REPORT_DIR}"
export PATH="${TOOL_DIR}:${PATH}"

sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

# Install an anchore tool at the exact pinned version if it is not already
# present at that version. No remote script is ever executed: the release
# tarball is downloaded directly from the pinned GitHub release and its sha256
# is verified against the repository-pinned digest table above before the
# binary is unpacked.
ensure_tool() {
  local name="$1" version="$2"
  if command -v "${name}" >/dev/null 2>&1; then
    local have
    have="$("${name}" version 2>/dev/null | awk -v n="^Version:" '$0 ~ n {print $2; exit}')"
    [ -z "${have}" ] && have="$("${name}" --version 2>/dev/null | awk '{print $NF; exit}')"
    if [ "v${have#v}" = "${version}" ]; then
      return 0
    fi
  fi
  echo "installing ${name} ${version} into ${TOOL_DIR}" >&2

  local os arch ver tarball tmp expected actual
  case "$(uname -s)" in
    Linux) os="linux" ;;
    Darwin) os="darwin" ;;
    *)
      echo "unsupported platform: $(uname -s). On Windows, run these commands inside WSL." >&2
      exit 1
      ;;
  esac
  case "$(uname -m)" in
    x86_64) arch="amd64" ;;
    aarch64 | arm64) arch="arm64" ;;
    *)
      echo "unsupported architecture: $(uname -m)" >&2
      exit 1
      ;;
  esac

  expected="$(pinned_digest "${name}_${os}_${arch}")"
  if [ -z "${expected}" ]; then
    echo "no pinned digest for ${name}_${os}_${arch} - add it to the table in this script" >&2
    exit 1
  fi

  ver="${version#v}"
  tarball="${name}_${ver}_${os}_${arch}.tar.gz"
  tmp="$(mktemp -d)"

  curl -sSfL --retry 3 --retry-delay 2 -o "${tmp}/${tarball}" \
    "https://github.com/anchore/${name}/releases/download/${version}/${tarball}"

  actual="$(sha256_file "${tmp}/${tarball}")"
  if [ "${actual}" != "${expected}" ]; then
    echo "DIGEST MISMATCH for ${tarball}: expected ${expected}, got ${actual}" >&2
    rm -rf "${tmp}"
    exit 1
  fi

  tar -xzf "${tmp}/${tarball}" -C "${tmp}" "${name}"
  install -m 0755 "${tmp}/${name}" "${TOOL_DIR}/${name}"
  rm -rf "${tmp}"
}

# The SBOM is stale when the dependency inputs changed after it was written; a
# stale SBOM silently scans yesterday's tree. The reference list must cover
# every lockfile the SBOM catalogs, including the mobile native ones.
sbom_is_stale() {
  [ -f "${CDX_SBOM}" ] || return 0
  local ref
  for ref in \
    "${REPO_ROOT}/pnpm-lock.yaml" \
    "${REPO_ROOT}/package.json" \
    "${REPO_ROOT}/apps/mobileAppYC/android/app/gradle.lockfile" \
    "${REPO_ROOT}/apps/mobileAppYC/ios/Podfile.lock"; do
    if [ "${ref}" -nt "${CDX_SBOM}" ]; then
      return 0
    fi
  done
  return 1
}

# Exceptions in .grype.yaml and .grant.yaml carry machine-readable re-review
# dates. An expired exception fails the gate instead of quietly outliving its
# justification.
check_exception_expiry() {
  local today horizon dates invalid over_horizon expired
  today="$(date +%Y-%m-%d)"
  # Two years is the outer bound for any re-review date: "expiring exceptions"
  # means a bounded window, and the cap also rejects never-reachable far-future
  # dates. GNU date first (CI), BSD date fallback (macOS).
  horizon="$(date -d '+2 years' +%Y-%m-%d 2>/dev/null || date -v+2y +%Y-%m-%d)"
  # `|| true`: zero dated lines anywhere makes grep exit 1, which pipefail +
  # set -e would otherwise turn into a silent scan death.
  dates="$(grep -hoE 'Re-review by: [0-9]{4}-[0-9]{2}-[0-9]{2}' \
    "${REPO_ROOT}/.grype.yaml" "${REPO_ROOT}/.grant.yaml" 2>/dev/null |
    awk '{ print $3 }')" || true
  # Digit shape alone is not a date: 9999-99-99 matches the pattern, compares
  # lexically as forever-in-the-future, and would never expire. Reject anything
  # that is not a real calendar day (leap years included).
  invalid="$(awk '
    NF == 0 { next }
    {
      split($0, p, "-"); y = p[1] + 0; m = p[2] + 0; d = p[3] + 0
      split("31 28 31 30 31 30 31 31 30 31 30 31", dim, " ")
      leap = (y % 4 == 0 && (y % 100 != 0 || y % 400 == 0))
      maxd = (m >= 1 && m <= 12) ? dim[m] + ((m == 2 && leap) ? 1 : 0) : 0
      if (m < 1 || m > 12 || d < 1 || d > maxd) print $0
    }' <<<"${dates}")"
  over_horizon="$(awk -v h="${horizon}" 'NF > 0 && $0 > h { print }' <<<"${dates}")"
  expired="$(awk -v t="${today}" 'NF > 0 && $0 < t { print }' <<<"${dates}")"
  if [ -n "${invalid}" ]; then
    echo "INVALID re-review dates (not real calendar days): ${invalid}" >&2
  fi
  if [ -n "${over_horizon}" ]; then
    echo "OVER-HORIZON re-review dates (more than 2 years out, max ${horizon}): ${over_horizon}" >&2
  fi
  if [ -n "${expired}" ]; then
    echo "EXPIRED security exceptions (re-review dates in the past): ${expired}" >&2
  fi
  if [ -n "${invalid}${over_horizon}${expired}" ]; then
    echo "Re-review each entry in .grype.yaml / .grant.yaml and either fix the finding or renew the date with a fresh justification." >&2
    return 1
  fi
  return 0
}

# Expiry enforcement only works when every exception carries a date: an
# ignore-packages entry whose comment lacks a dated 'Re-review by:' line would
# suppress findings forever, so it fails the gate here. Each comment block
# dates the run of entries directly below it (families share one block).
# One parser for both exception files. Entries are the '- ' lines sharing the
# section's item indent, learned from the FIRST hyphen line in the section, so
# both the two-space and the equally-valid column-0 sequence layouts are
# parsed; deeper hyphens are an entry's own nested fields. A non-empty
# flow-style sequence ('ignore: [...]') cannot carry per-entry comments at
# all, so it is rejected outright rather than silently under-parsed - the
# guard must fail closed on layouts it cannot read.
# The guard is a layout gate, not a YAML parser, so it cannot chase every
# valid-YAML spelling of the same key (quotes, whitespace before the colon,
# explicit-key form, ...). Instead it enforces the one canonical spelling and
# REJECTS any other recognizable spelling of the section key outright - a
# respelled section fails the gate instead of becoming invisible to it.
_assert_canonical_section() {
  local file="$1" section="$2" variants
  variants="$(grep -nE "^[[:space:]]*\\??[[:space:]]*[\"']?${section}[\"']?[[:space:]]*(:|\$)" "${file}" 2>/dev/null |
    grep -vE "^[0-9]+:${section}:")" || true
  if [ -n "${variants}" ]; then
    echo "NON-CANONICAL spelling of '${section}:' in $(basename "${file}") (${variants}) - the exception guard only inspects the documented layout; spell the key exactly '${section}:' at column 0." >&2
    return 1
  fi
  # Presence is REQUIRED: a document that hides the section from line-level
  # inspection (a root flow mapping, an exotic key form, or simply deleting
  # the section) must fail rather than sail through unexaminable. Keep an
  # empty '${section}: []' line when there are no exceptions.
  if ! grep -qE "^${section}:" "${file}" 2>/dev/null; then
    echo "MISSING canonical '${section}:' section in $(basename "${file}") - the guard requires it present at column 0 (use '${section}: []' when empty); a layout it cannot inspect fails closed." >&2
    return 1
  fi
  return 0
}

_undated_exception_entries() {
  local file="$1" section="$2"
  awk -v section="${section}" '
    BEGIN { sec = "^" section ":" }
    !insec && $0 ~ sec {
      insec = 1
      rest = $0; sub(sec, "", rest); gsub(/[[:space:]]/, "", rest)
      if (rest != "" && rest != "[]") { print "UNSUPPORTED_LAYOUT"; exit }
      next
    }
    insec && /^[^[:space:]#-]/ { insec = 0 }
    !insec { next }
    /^[[:space:]]*#/ {
      if (prev == "item") have = 0
      if ($0 ~ /Re-review by: [0-9]{4}-[0-9]{2}-[0-9]{2}/) have = 1
      prev = "comment"; next
    }
    # A blank line ends the comment block a date belongs to, exactly as a
    # comment following an item does. Skipping it outright kept have=1 across
    # the gap, so an item separated from the last dated entry by nothing but a
    # blank line inherited that date and passed the gate undated.
    /^[[:space:]]*$/ {
      if (prev == "item") have = 0
      prev = "blank"
      next
    }
    /^[[:space:]]*-([[:space:]]|$)/ {
      ind = index($0, "-")
      if (!itemind) itemind = ind
      if (ind == itemind) {
        if (!have) { entry = $0; sub(/^[[:space:]]*-[[:space:]]*/, "", entry); print entry }
        prev = "item"
      }
      next
    }
  ' "${file}" 2>/dev/null
}

check_exception_dates() {
  local failed=0 file section label out
  for label in "grant:.grant.yaml:ignore-packages" "grype:.grype.yaml:ignore"; do
    file="${REPO_ROOT}/$(echo "${label}" | cut -d: -f2)"
    section="$(echo "${label}" | cut -d: -f3)"
    if ! _assert_canonical_section "${file}" "${section}"; then
      failed=1
      continue
    fi
    out="$(_undated_exception_entries "${file}" "${section}")" || true
    if echo "${out}" | grep -q 'UNSUPPORTED_LAYOUT'; then
      echo "UNSUPPORTED layout for '${section}:' in $(basename "${file}"): a non-empty flow-style sequence cannot carry the required per-entry comments - use the documented block layout." >&2
      failed=1
    elif [ -n "${out}" ]; then
      echo "UNDATED security exceptions in $(basename "${file}") ${section} (no dated 'Re-review by: YYYY-MM-DD' comment): ${out}" >&2
      failed=1
    fi
  done
  if [ "${failed}" -ne 0 ]; then
    echo "Every exception must carry a machine-readable re-review date so expiry stays enforced - date the entry's comment block." >&2
    return 1
  fi
  return 0
}

cmd_sbom() {
  ensure_tool syft "${SYFT_VERSION}"
  if [ ! -d "${REPO_ROOT}/node_modules" ]; then
    echo "node_modules missing - run pnpm install first (license metadata comes from the installed packages)" >&2
    exit 2
  fi
  # node_modules (including the .pnpm store) IS cataloged: the installed
  # packages carry the license metadata the lockfile lacks, and pnpm's layout
  # means the store is where the real package.json files live. The native
  # lockfiles (android gradle.lockfile, ios Podfile.lock) stay IN scope - they
  # carry the mobile app's Maven and CocoaPods dependencies - while build
  # output and vendored pods are excluded. NOTE: the iOS Podfile.lock is not
  # yet committed (#2129), so pods are absent from the SBOM until it lands;
  # the staleness check already watches its path for that day.
  local excludes=(
    --exclude './**/.next/**'
    --exclude './**/dist/**'
    --exclude './**/build/**'
    --exclude './**/coverage/**'
    --exclude './apps/frontend/public/dev-docs/**'
    --exclude './apps/mobileAppYC/android/.gradle/**'
    --exclude './apps/mobileAppYC/ios/Pods/**'
    --exclude './.security-tools/**'
    --exclude './security/**'
  )
  # The installed-package cataloger is image-scan-only by default, but it is
  # what reads each node_modules package.json - the only place npm license
  # metadata lives (the lockfile has none). Select it in addition to the
  # default lock catalogers so the license gate has real data to check.
  syft scan "dir:${REPO_ROOT}" "${excludes[@]}" \
    --select-catalogers "+javascript-package-cataloger" \
    --source-name yosemite-crew \
    -o "cyclonedx-json=${CDX_SBOM}" -o "spdx-json=${SPDX_SBOM}"
  echo "SBOMs written: ${CDX_SBOM} and ${SPDX_SBOM}" >&2
}

cmd_scan() {
  ensure_tool grype "${GRYPE_VERSION}"
  if sbom_is_stale; then
    echo "SBOM missing or older than the lockfile - regenerating" >&2
    cmd_sbom
  fi
  check_exception_dates
  check_exception_expiry
  # --fail-on critical is the merge gate (#1721: critical vulnerabilities block
  # merges). Known-accepted findings live in .grype.yaml with a reason and an
  # expiry - see docs/security/supply-chain.md for the exception process.
  grype "sbom:${CDX_SBOM}" \
    --config "${REPO_ROOT}/.grype.yaml" \
    -o "sarif=${REPORT_DIR}/grype.sarif" \
    -o table \
    --fail-on critical
}

cmd_licenses() {
  ensure_tool grant "${GRANT_VERSION}"
  if sbom_is_stale; then
    echo "SBOM missing or older than the lockfile - regenerating" >&2
    cmd_sbom
  fi
  check_exception_dates
  check_exception_expiry
  # Policy in .grant.yaml: allowlist of AGPL-3.0-compatible licenses, deny
  # everything else. The repository is AGPL-3.0 with a CC-BY-3.0/4.0 combining
  # exception (License.txt), so both CC-BY versions are allowed.
  grant check "${CDX_SBOM}" --config "${REPO_ROOT}/.grant.yaml" -o table
}

case "${1:-all}" in
  sbom) cmd_sbom ;;
  scan) cmd_scan ;;
  licenses) cmd_licenses ;;
  all)
    cmd_sbom
    cmd_scan
    cmd_licenses
    ;;
  *)
    echo "usage: $0 {sbom|scan|licenses|all}" >&2
    exit 2
    ;;
esac
