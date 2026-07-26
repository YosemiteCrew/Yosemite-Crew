#!/usr/bin/env node
// Fail when an entry in the root pnpm.overrides block pins a version that has a
// known advisory.
//
// Usage:
//   node scripts/ci/check-override-advisories.mjs
//   node scripts/ci/check-override-advisories.mjs --no-baseline
//   node scripts/ci/check-override-advisories.mjs --audit-json audit.json
//   node scripts/ci/check-override-advisories.mjs --strict
//
// Why this exists, and why dependabot does not cover it:
//
// A pnpm override forces resolution regardless of what any manifest asks for.
// That makes overrides the right tool for patching a transitive dependency, and
// it also makes them a trap: once an override pins an exact version, that
// version is frozen until a human edits the root package.json. Dependabot can
// raise a PR against a manifest, but the override pins resolution straight back,
// so the advisory stays open while the PR looks like it fixed it.
//
// The failure mode is not hypothetical. `fast-uri` was raised 3.1.2 -> 3.1.3 to
// clear the advisory of the day; 3.1.4 superseded it and the override held 3.1.3
// in place with nothing watching. This script is the thing that watches.
//
// How it decides:
//
// `pnpm audit` reports advisories against the *resolved* tree, which is exactly
// the tree the overrides produced. So an advisory whose installed version equals
// an override's pinned value is, by construction, an override pinning a
// vulnerable version. Matching on the exact installed version rather than on
// semver ranges keeps the check precise and dependency-free: `uuid` has an
// advisory for the 7.x/8.x copies in the tree, but the two `uuid` overrides pin
// 11.1.1, so they are correctly left alone.
//
// Known limitation: an override pinning a package that nothing actually resolves
// to is invisible here, because it never appears in the audited tree. Such an
// override is also inert, so it carries no runtime risk.
//
// Exit codes:
//   0  no un-accepted override pins a vulnerable version
//   1  at least one does (or the manifest/baseline could not be read)
//   2  advisory data was unavailable and --strict was passed

import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const DEFAULT_MANIFEST = path.join(REPO_ROOT, 'package.json');
const DEFAULT_BASELINE = path.join(HERE, 'override-advisory-baseline.json');

const SEVERITY_ORDER = ['critical', 'high', 'moderate', 'low', 'info'];

// Thrown for expected, explainable failures (bad arguments, unreadable files).
// The CLI wrapper turns these into a one-line message and exit 1; anything else
// escaping main() is a genuine bug and keeps its stack trace.
export class CheckError extends Error {}

function fail(message) {
  throw new CheckError(message);
}

// --- pure helpers (exported for the test file; no I/O, no network) -----------

// Override keys come in several shapes, all of which have to reduce to a bare
// package name before they can be matched against an advisory's module_name:
//   'axios'                     -> axios
//   'axios@1.15.2'              -> axios          (version-selector form)
//   'brace-expansion@<2.0.0'    -> brace-expansion (range-selector form)
//   '@tiptap/core@<=3.27.0'     -> @tiptap/core    (scoped + selector)
//   '@protobufjs/utf8'          -> @protobufjs/utf8
//   '@aws-cdk/toolkit-lib>yaml' -> yaml            (parent>child form)
//   'brace-expansion@>=5.0.0'   -> brace-expansion (the '>' is a range operator,
//                                                   not a parent separator)
export function parseOverrideKey(key) {
  const trimmed = key.trim();

  // Scan right to left for the parent>child separator. A '>' belonging to a
  // range selector ('@>=5.0.0', '@>1.2.3') is followed by '=' or a digit; a real
  // separator is followed by the first character of a package name.
  let child = trimmed;
  for (let i = trimmed.length - 1; i >= 0; i -= 1) {
    const next = trimmed[i + 1];
    if (trimmed[i] === '>' && next && !/[=\d]/.test(next)) {
      child = trimmed.slice(i + 1);
      break;
    }
  }

  // On a scoped name the leading '@' is part of the name, so the selector
  // separator is the *next* '@'.
  const searchFrom = child.startsWith('@') ? 1 : 0;
  const at = child.indexOf('@', searchFrom);
  return at === -1 ? child : child.slice(0, at);
}

const EXACT_VERSION = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

export function isExactVersion(value) {
  return EXACT_VERSION.test(value);
}

// package name -> [{ key, pinned }], because a single package is routinely
// overridden more than once (a blanket entry plus selector-scoped entries).
export function indexOverrides(overrides) {
  const index = new Map();
  for (const [key, pinned] of Object.entries(overrides ?? {})) {
    const name = parseOverrideKey(key);
    if (!name) continue;
    const entries = index.get(name) ?? [];
    entries.push({ key, pinned });
    index.set(name, entries);
  }
  return index;
}

// '>=7.5.19' -> '7.5.19'. Advisory data expresses the fix as a range; the number
// a human needs to paste into package.json is the lower bound of that range.
// '<0.0.0' is npm's encoding of "no patched version exists".
export function fixedVersionFrom(patchedVersions) {
  if (!patchedVersions || patchedVersions === '<0.0.0') return null;
  const match = /(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/.exec(patchedVersions);
  return match ? match[1] : null;
}

export function advisoryId(advisory) {
  return advisory.github_advisory_id || (advisory.id != null ? String(advisory.id) : 'unknown');
}

export function baselineKey(finding) {
  return `${finding.package}@${finding.pinned}:${finding.advisory}`;
}

// Cross-reference the overrides against the audited tree.
export function findVulnerablePins(overrides, audit) {
  const index = indexOverrides(overrides);
  const findings = [];

  for (const advisory of Object.values(audit?.advisories ?? {})) {
    const pins = index.get(advisory.module_name);
    if (!pins) continue; // not overridden - a plain dependabot bump fixes it

    const installed = [...new Set((advisory.findings ?? []).map((f) => f.version).filter(Boolean))];

    for (const pin of pins) {
      const exact = isExactVersion(pin.pinned);
      // An exact pin is vulnerable when the tree actually resolved to it. A
      // range pin cannot be compared without a semver engine, so any vulnerable
      // copy of an overridden package is reported and the range is shown.
      const hit = exact ? installed.includes(pin.pinned) : installed.length > 0;
      if (!hit) continue;

      findings.push({
        package: advisory.module_name,
        overrideKey: pin.key,
        pinned: pin.pinned,
        pinIsRange: !exact,
        installed,
        advisory: advisoryId(advisory),
        severity: advisory.severity ?? 'unknown',
        title: advisory.title ?? '',
        vulnerableVersions: advisory.vulnerable_versions ?? 'unknown',
        patchedVersions: advisory.patched_versions ?? '',
        fixedIn: fixedVersionFrom(advisory.patched_versions),
        url: advisory.url ?? '',
      });
    }
  }

  findings.sort((a, b) => {
    const bySeverity = SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
    if (bySeverity !== 0) return bySeverity;
    return a.package.localeCompare(b.package) || a.overrideKey.localeCompare(b.overrideKey);
  });

  return findings;
}

// Split findings into the ones an accepted-drift baseline already covers and the
// ones it does not. A baseline entry is keyed on package + pinned version +
// advisory id, so it expires by construction: bump the override, or let a new
// advisory land against the same pin, and the entry stops matching.
export function applyBaseline(findings, baseline) {
  const accepted = new Map(
    (baseline?.accepted ?? []).map((entry) => [
      `${entry.package}@${entry.pinned}:${entry.advisory}`,
      entry,
    ])
  );
  const matched = new Set();
  const unaccepted = [];
  const known = [];

  for (const finding of findings) {
    const key = baselineKey(finding);
    if (accepted.has(key)) {
      matched.add(key);
      known.push(finding);
    } else {
      unaccepted.push(finding);
    }
  }

  const stale = [...accepted.entries()]
    .filter(([key]) => !matched.has(key))
    .map(([, entry]) => entry);

  return { unaccepted, known, stale };
}

export function formatFinding(finding) {
  const lines = [
    `  ${finding.package}  [${finding.severity}]`,
    `    override key:  ${JSON.stringify(finding.overrideKey)}`,
    `    pinned at:     ${finding.pinned}${finding.pinIsRange ? ' (range, not an exact pin)' : ''}`,
    `    installed:     ${finding.installed.join(', ') || 'unknown'}`,
    `    advisory:      ${finding.advisory}`,
  ];
  if (finding.title) lines.push(`    title:         ${finding.title}`);
  lines.push(`    vulnerable:    ${finding.vulnerableVersions}`);
  lines.push(
    finding.fixedIn
      ? `    fixed in:      ${finding.fixedIn}  (patched range ${finding.patchedVersions})`
      : `    fixed in:      no patched version published (${finding.patchedVersions || 'none'})`
  );
  if (finding.url) lines.push(`    url:           ${finding.url}`);
  return lines.join('\n');
}

// --- I/O --------------------------------------------------------------------

function readJson(file, label) {
  let raw;
  try {
    if (file.includes('..') || path.isAbsolute(file)) {
      fail(`cannot read ${label} at ${file}: invalid path`);
    }
    raw = readFileSync(file, 'utf8');
  } catch (error) {
    fail(`cannot read ${label} at ${file}: ${error.message}`);
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    fail(`${label} at ${file} is not valid JSON: ${error.message}`);
  }
}

// `pnpm audit` exits non-zero whenever it finds anything, which is the normal
// case here - the whole point is to detect pins that are still vulnerable. So
// the exit code is deliberately ignored and the stdout payload is the signal:
// parseable JSON means the audit ran, anything else means it could not reach the
// registry (or pnpm itself failed) and no conclusion can be drawn.
export function readAuditJson({ cwd }) {
  const result = spawnSync('pnpm', ['audit', '--json'], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });

  if (result.error) {
    return { ok: false, reason: `could not run 'pnpm audit': ${result.error.message}` };
  }

  const stdout = (result.stdout ?? '').trim();
  if (!stdout) {
    const stderr = (result.stderr ?? '').trim().split('\n').slice(-3).join(' | ');
    return {
      ok: false,
      reason: `'pnpm audit --json' produced no output (exit ${result.status})${
        stderr ? `: ${stderr}` : ''
      }`,
    };
  }

  try {
    const audit = JSON.parse(stdout);
    if (!audit || typeof audit !== 'object' || !('advisories' in audit)) {
      return { ok: false, reason: "'pnpm audit --json' output has no 'advisories' key" };
    }
    return { ok: true, audit };
  } catch {
    const head = stdout.slice(0, 200).replace(/\s+/g, ' ');
    return {
      ok: false,
      reason: `'pnpm audit --json' output is not JSON (exit ${result.status}): ${head}`,
    };
  }
}

function parseArgs(argv) {
  const args = {
    manifest: DEFAULT_MANIFEST,
    baseline: DEFAULT_BASELINE,
    useBaseline: true,
    auditJson: '',
    strict: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--strict') {
      args.strict = true;
    } else if (flag === '--no-baseline') {
      args.useBaseline = false;
    } else if (flag === '--manifest' || flag === '--baseline' || flag === '--audit-json') {
      const value = argv[i + 1];
      if (!value) fail(`${flag} requires a file path`);
      args[flag === '--audit-json' ? 'auditJson' : flag.slice(2)] = value;
      i += 1;
    } else if (flag === '--help' || flag === '-h') {
      args.help = true;
    } else {
      fail(`unknown argument '${flag}'`);
    }
  }
  return args;
}

const USAGE = `Usage: node scripts/ci/check-override-advisories.mjs [options]

  --audit-json <file>  read 'pnpm audit --json' output from a file instead of
                       running pnpm (also the offline / air-gapped path)
  --baseline <file>    accepted-drift baseline (default scripts/ci/override-advisory-baseline.json)
  --no-baseline        ignore the baseline and report every vulnerable pin
  --manifest <file>    package.json holding pnpm.overrides (default repo root)
  --strict             treat unreachable advisory data as a failure (exit 2)
  -h, --help           show this message`;

// `readAudit` is injectable so the offline branch can be exercised without a
// network call, and so tests never shell out to pnpm.
export function main(argv, { readAudit = readAuditJson } = {}) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(USAGE);
    return 0;
  }

  const manifest = readJson(args.manifest, 'manifest');
  const overrides = manifest?.pnpm?.overrides;
  if (!overrides || typeof overrides !== 'object') {
    fail(`${args.manifest} has no pnpm.overrides block, so there is nothing to check`);
  }
  const overrideCount = Object.keys(overrides).length;

  let audit;
  if (args.auditJson) {
    audit = readJson(args.auditJson, 'audit report');
  } else {
    const result = readAudit({ cwd: path.dirname(path.resolve(args.manifest)) });
    if (!result.ok) {
      // Offline behaviour: warn and pass by default, fail only under --strict.
      //
      // This check is a drift detector, not the primary security gate - Aikido,
      // dependabot and dependency-review all still run. Hard-failing on a
      // registry timeout would make it flaky, and a flaky security check gets
      // routed around, which is strictly worse than one that says plainly that
      // it could not run. --strict exists so a scheduled security job can opt
      // into fail-closed, where a silent skip really would be a hole.
      console.error(`check-override-advisories: advisory data unavailable - ${result.reason}`);
      if (args.strict) {
        console.error('check-override-advisories: --strict was passed, so this is a failure.');
        return 2;
      }
      console.error(
        'check-override-advisories: SKIPPED (no advisory data). Overrides were NOT verified. ' +
          'Re-run with network access, or pass --strict to make this a failure.'
      );
      return 0;
    }
    audit = result.audit;
  }

  const findings = findVulnerablePins(overrides, audit);
  const baseline =
    args.useBaseline && existsSync(args.baseline) ? readJson(args.baseline, 'baseline') : null;
  const { unaccepted, known, stale } = applyBaseline(findings, baseline);

  console.log(`check-override-advisories: ${overrideCount} override entries checked`);
  console.log(`  advisories in tree:  ${Object.keys(audit.advisories ?? {}).length}`);
  console.log(`  vulnerable pins:     ${findings.length}`);
  if (baseline) console.log(`  accepted (baseline): ${known.length}`);

  for (const entry of stale) {
    console.log(
      `check-override-advisories: baseline entry ${entry.package}@${entry.pinned} ` +
        `(${entry.advisory}) no longer matches anything - delete it from ${path.relative(REPO_ROOT, args.baseline)}`
    );
  }

  if (known.length > 0) {
    console.log('\nAccepted drift (already recorded in the baseline):');
    for (const finding of known) {
      console.log(
        `  ${JSON.stringify(finding.overrideKey)} -> ${finding.pinned} - ` +
          `${finding.advisory} [${finding.severity}]` +
          `${finding.fixedIn ? ` - fixed in ${finding.fixedIn}` : ' - no fix published'}`
      );
    }
  }

  if (unaccepted.length === 0) {
    console.log(
      '\ncheck-override-advisories: OK - no unreviewed override pins a vulnerable version'
    );
    return 0;
  }

  console.error(
    `\ncheck-override-advisories: ${unaccepted.length} override entr` +
      `${unaccepted.length === 1 ? 'y pins' : 'ies pin'} a version with a known advisory\n`
  );
  for (const finding of unaccepted) {
    console.error(formatFinding(finding));
    console.error('');
  }
  console.error(
    'Fix by raising the value in the pnpm.overrides block of package.json to the ' +
      "'fixed in' version above, then re-running pnpm install. Bumping the dependent " +
      'package alone will not work: the override pins resolution regardless.\n' +
      'If a bump is genuinely blocked, record it in ' +
      `${path.relative(REPO_ROOT, args.baseline)} with a reason.`
  );
  return 1;
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (error) {
    if (!(error instanceof CheckError)) throw error;
    console.error(`check-override-advisories: ${error.message}`);
    process.exit(1);
  }
}
