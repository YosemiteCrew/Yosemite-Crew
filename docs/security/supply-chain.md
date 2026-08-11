# Supply-chain security

Implements the supply-chain security initiative (#1721): SBOM generation,
vulnerability scanning, and AGPL license compliance, wired so the local
commands and the CI gate are the same script and can never drift apart.

## The one command

```bash
pnpm security:all        # SBOM, then vulnerability scan, then license check
```

Or individually:

```bash
pnpm security:sbom       # SPDX + CycloneDX SBOMs into security/sbom/
pnpm security:scan       # grype over the SBOM - FAILS on critical findings
pnpm security:licenses   # grant over the SBOM - FAILS on non-allowlisted licenses
```

`pnpm install` must have run first: npm license metadata only exists in the
installed packages, not in `pnpm-lock.yaml`.

Tools are installed by downloading the pinned release tarball directly from
GitHub and verifying its sha256 against a digest table pinned IN THIS
REPOSITORY (top of the script) - no remote install script is ever executed,
and a compromised upstream release cannot pass verification because the
digests do not travel with the artifact. Bumping a tool version means
refreshing the table, reviewed like any code change.

CI (`.github/workflows/supply-chain.yml`) runs the same
`scripts/security/supply-chain.sh` on every PR and push to `dev`/`main`, and
attaches both SBOMs to every published release. Tool versions (syft, grype,
grant) are pinned once, at the top of that script.

## What gates, what reports

| Check                   | Gate                                                             | Report                                                               |
| ----------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------- |
| Vulnerabilities (grype) | Critical findings fail the job                                   | Full SARIF uploaded as an artifact and to the Security tab           |
| Licenses (grant)        | Any license outside the allowlist in `.grant.yaml` fails the job | Table in the job log                                                 |
| SBOM (syft)             | Generation failure fails the job                                 | SPDX + CycloneDX artifacts, 90-day retention; release assets on tags |

Two knowingly-open edges, both tracked in config comments:

- `require-license` is `false`: ~295 installed packages carry no
  machine-readable license. Flipping it on is the follow-up hardening once
  that tail is triaged.
- The `stream-chat` and `@calcom/embed` families are proprietary vendor SDKs
  recorded as EXPIRING exceptions pending an explicit licensing decision -
  see `.grant.yaml`. They are findings, not clearances.

## The exception process

Gates fail closed; exceptions are explicit, reviewed, and expiring.

1. **Vulnerabilities**: add an entry under `ignore:` in `.grype.yaml` with the
   GHSA id and package, plus a comment carrying the reason it is acceptable,
   an owner, and a `Re-review by: YYYY-MM-DD` date. Same discipline as
   `scripts/ci/override-advisory-baseline.json`. **Expiry is machine-enforced:
   the scan and license gates fail when any re-review date is in the past**,
   so an exception cannot quietly outlive its justification - and they fail
   just the same on any `ignore:` entry whose comment lacks a dated line, so
   an undated vulnerability exception cannot escape enforcement either. Dates
   must be real calendar days no more than two years out: an impossible value
   like 9999-99-99 or a decade-away date is rejected. The guard enforces the
   exact canonical layout - `ignore:` / `ignore-packages:` at column 0,
   unquoted, and PRESENT (write `ignore: []` when there are no exceptions) -
   and fails on any other spelling of the section keys or on a document form
   it cannot inspect (a root flow mapping, a deleted section) rather than
   silently passing what it could not examine.
2. **Licenses**: extend `allow:` in `.grant.yaml` only with the SPDX
   compatibility rationale in the PR, or add a package under
   `ignore-packages:` with a comment: the VERIFIED license (read the LICENSE
   file in the installed package, not the package.json field), the reason, an
   owner, and a dated `Re-review by: YYYY-MM-DD` line. The gates fail on any
   `ignore-packages` entry whose comment lacks that dated line, so an undated
   exception cannot escape expiry enforcement.
3. Exceptions are reviewed like code - they ride the same PR gates.

## Notes for maintainers

- The SBOM catalogs the installed tree (`node_modules` including the pnpm
  store) plus the lockfile, with build output excluded. The installed-package
  cataloger is selected explicitly because it is what carries license
  metadata; the lockfile alone has none.
- grype and grant read the CycloneDX SBOM; the script regenerates it
  automatically whenever `pnpm-lock.yaml`, the root `package.json`, or a
  mobile native lockfile (`android/app/gradle.lockfile`, `ios/Podfile.lock`)
  is newer than the cached copy, so a stale SBOM is never scanned silently.
- The SBOM also catalogs the Android native lockfile (`android/
app/gradle.lockfile` Maven deps) - only build output and vendored pods are
  excluded. The iOS `Podfile.lock` is NOT yet committed, so CocoaPods
  dependencies are absent from the SBOM until #2129 lands (the staleness
  check already watches its path).
- Releases published by workflows authenticating with `GITHUB_TOKEN`
  (desktop-release, release-notes) do not emit a `release` event this
  workflow can observe. The user's tag push covers gating and SBOM artifacts
  for those refs; to attach the assets to such a release, run the workflow
  via `workflow_dispatch` from the tag ref with the `release_tag` input set
  to that tag. The SBOM is built from the dispatched ref, so the publish job
  fails closed unless the dispatch ref IS `refs/tags/<release_tag>` - a
  dispatch from any other ref would otherwise clobber the release's SBOMs
  with artifacts built from different code.
- The dependency install runs on Linux in CI, so packages restricted to other
  platforms via the `os` field contribute lockfile entries (completeness) but
  no installed license metadata - a known, documented margin.
- Windows is not supported natively; run the commands inside WSL.
- `security/` and `.security-tools/` are gitignored output/tool directories.
