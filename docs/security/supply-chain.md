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
   an owner, and a re-review date. Same discipline as
   `scripts/ci/override-advisory-baseline.json`.
2. **Licenses**: extend `allow:` in `.grant.yaml` only with the SPDX
   compatibility rationale in the PR, or add a package under
   `ignore-packages:` with a comment: the VERIFIED license (read the LICENSE
   file in the installed package, not the package.json field), the reason, an
   owner, and a re-review date.
3. Exceptions are reviewed like code - they ride the same PR gates.

## Notes for maintainers

- The SBOM catalogs the installed tree (`node_modules` including the pnpm
  store) plus the lockfile, with build output excluded. The installed-package
  cataloger is selected explicitly because it is what carries license
  metadata; the lockfile alone has none.
- grype and grant read the CycloneDX SBOM, so `security:sbom` (or a cached
  `security/sbom/`) must exist first; the script generates it on demand.
- `security/` and `.security-tools/` are gitignored output/tool directories.
