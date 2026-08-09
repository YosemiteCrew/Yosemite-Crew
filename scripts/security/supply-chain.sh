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
# runs this script; bump them here and everywhere follows.
SYFT_VERSION="v1.50.0"
GRYPE_VERSION="v0.116.1"
GRANT_VERSION="v0.6.8"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TOOL_DIR="${REPO_ROOT}/.security-tools/bin"
SBOM_DIR="${REPO_ROOT}/security/sbom"
REPORT_DIR="${REPO_ROOT}/security/reports"
CDX_SBOM="${SBOM_DIR}/yosemite-crew.cdx.json"
SPDX_SBOM="${SBOM_DIR}/yosemite-crew.spdx.json"

mkdir -p "${TOOL_DIR}" "${SBOM_DIR}" "${REPORT_DIR}"
export PATH="${TOOL_DIR}:${PATH}"

# Install an anchore tool at the exact pinned version if it is not already
# present at that version. The anchore install script verifies the release
# checksums before unpacking.
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
  curl -sSfL "https://raw.githubusercontent.com/anchore/${name}/main/install.sh" |
    sh -s -- -b "${TOOL_DIR}" "${version}"
}

cmd_sbom() {
  ensure_tool syft "${SYFT_VERSION}"
  if [ ! -d "${REPO_ROOT}/node_modules" ]; then
    echo "node_modules missing - run pnpm install first (license metadata comes from the installed packages)" >&2
    exit 2
  fi
  # node_modules (including the .pnpm store) IS cataloged: the installed
  # packages carry the license metadata the lockfile lacks, and pnpm's layout
  # means the store is where the real package.json files live.
  local excludes=(
    --exclude './**/.next/**'
    --exclude './**/dist/**'
    --exclude './**/build/**'
    --exclude './**/coverage/**'
    --exclude './apps/frontend/public/dev-docs/**'
    --exclude './apps/mobileAppYC/android/**'
    --exclude './apps/mobileAppYC/ios/**'
    --exclude './.security-tools/**'
    --exclude './security/**'
  )
  # The installed-package cataloger is image-scan-only by default, but it is
  # what reads each node_modules package.json - the only place npm license
  # metadata lives (the lockfile has none). Select it in addition to the
  # default lock cataloger so the license gate has real data to check.
  syft scan "dir:${REPO_ROOT}" "${excludes[@]}" \
    --select-catalogers "+javascript-package-cataloger" \
    --source-name yosemite-crew \
    -o "cyclonedx-json=${CDX_SBOM}" -o "spdx-json=${SPDX_SBOM}"
  echo "SBOMs written: ${CDX_SBOM} and ${SPDX_SBOM}" >&2
}

cmd_scan() {
  ensure_tool grype "${GRYPE_VERSION}"
  [ -f "${CDX_SBOM}" ] || cmd_sbom
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
  [ -f "${CDX_SBOM}" ] || cmd_sbom
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
