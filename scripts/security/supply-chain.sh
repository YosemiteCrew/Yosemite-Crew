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
# stale SBOM silently scans yesterday's tree.
sbom_is_stale() {
  [ -f "${CDX_SBOM}" ] || return 0
  local ref
  for ref in "${REPO_ROOT}/pnpm-lock.yaml" "${REPO_ROOT}/package.json"; do
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
  local today expired
  today="$(date +%Y-%m-%d)"
  expired="$(grep -hoE 'Re-review by: [0-9]{4}-[0-9]{2}-[0-9]{2}' \
    "${REPO_ROOT}/.grype.yaml" "${REPO_ROOT}/.grant.yaml" 2>/dev/null |
    awk -v today="${today}" '{ if ($3 < today) print $3 }')"
  if [ -n "${expired}" ]; then
    echo "EXPIRED security exceptions (re-review dates in the past): ${expired}" >&2
    echo "Re-review each entry in .grype.yaml / .grant.yaml and either fix the finding or renew the date with a fresh justification." >&2
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
  # output and vendored pods are excluded.
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
