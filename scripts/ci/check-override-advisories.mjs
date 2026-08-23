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
// vulnerable version.
//
// There are two ways an override block can leave an advisory open, and this
// script reports both:
//
//   stale-pin       The pin itself is vulnerable. `fast-uri` was raised
//                   3.1.2 -> 3.1.3 to clear the advisory of the day; 3.1.4
//                   superseded it and the override held 3.1.3 in place.
//
//   uncovered-copy  The pin is patched, but the override *key* is too narrow to
//                   match the copies that are actually vulnerable, so the
//                   override never applies to them. `uuid` was pinned to a
//                   patched 11.1.1 under the exact keys `uuid@11.1.0` and
//                   `uuid@9.0.1`, while the vulnerable copies resolved at 7.0.3,
//                   8.0.0 and 8.3.2 via xcode, aws-sdk and sockjs. Neither key
//                   matches anything in the 7.x or 8.x lines, so six high alerts
//                   sat open while this check stayed silent. Answering only "is
//                   any pin stale" misses that entirely; the second question is
//                   "does any pin fail to COVER a vulnerable copy".
//
// Deciding the second question means comparing the override key as a semver
// range, which is delegated to `semver` - the same implementation pnpm resolves
// with. An earlier revision hand-rolled it to keep this file dependency-free
// and review found eight defects in that comparator, every one a silent false
// negative, so the constraint was dropped; other scripts here already take
// dependencies. Every range form semver understands is therefore evaluated,
// including compound ranges, x-ranges, caret and tilde, and prereleases.
//
// A selector semver cannot parse as a range at all - a workspace protocol, an
// npm alias - is treated as covering the version, which errs towards silence
// rather than a false alarm; the stale-pin check still watches that key.
//
// Known limitation: an override pinning a package that nothing actually resolves
// to is invisible here, because it never appears in the audited tree. Such an
// override is also inert, so it carries no runtime risk.
//
// Exit codes:
//   0  no un-accepted override pins or fails to cover a vulnerable version
//   1  at least one does (or the manifest/baseline could not be read)
//   2  advisory data was unavailable and --strict was passed

import semver from 'semver';

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
export function splitOverrideKey(key) {
  const trimmed = key.trim();

  // Scan right to left for the parent>child separator. A '>' can also be a
  // range operator, and the two are told apart by the character BEFORE it, not
  // after: an operator '>' always follows '@', '<', '>' or '='. Keying off the
  // character after instead would reject a perfectly valid child whose name
  // starts with a digit, such as 'foo>2fa', and index the whole string as a
  // package name so every advisory for that child is skipped.
  let child = trimmed;
  let parent = null;
  for (let i = trimmed.length - 1; i >= 0; i -= 1) {
    if (trimmed[i] !== '>') continue;
    const prev = trimmed[i - 1];
    if (prev === '@' || prev === '<' || prev === '>' || prev === '=') continue;
    // A separator is written without spaces ('parent>child'), so whitespace on
    // either side means this '>' is a range operator. Without this a compound
    // range like 'pkg@<1 || >2' split at the second operator: the child became
    // '2', the override was indexed under the package name '2', and every
    // advisory for the real package went unmatched - silently, as a pass.
    if (prev === undefined || /\s/.test(prev)) continue;
    if (i + 1 >= trimmed.length) continue;
    if (/\s/.test(trimmed[i + 1])) continue;
    child = trimmed.slice(i + 1);
    parent = trimmed.slice(0, i);
    break;
  }

  // On a scoped name the leading '@' is part of the name, so the selector
  // separator is the *next* '@'.
  const searchFrom = child.startsWith('@') ? 1 : 0;
  const at = child.indexOf('@', searchFrom);
  if (at === -1) return { name: child, selector: null, parent };
  return { name: child.slice(0, at), selector: child.slice(at + 1) || null, parent };
}

export function parseOverrideKey(key) {
  return splitOverrideKey(key).name;
}

const EXACT_VERSION = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

export function isExactVersion(value) {
  return EXACT_VERSION.test(value);
}

// Version ordering and range matching are delegated to `semver`, the same
// implementation pnpm resolves with. An earlier revision hand-rolled both to
// keep this file dependency-free, and review found four separate defects in it:
// partial comparator bounds padded with zeros rather than expanded, prereleases
// admitted into ordinary ranges, caret/tilde selectors carrying a prerelease
// falling through to the permissive fallback, and prerelease identifiers
// compared lexicographically so 1.0.0-alpha.10 sorted below 1.0.0-alpha.2.
// Each was a silent false negative in a security check. Other scripts here
// already take dependencies (scripts/ci/coverage uses istanbul-lib-*), so the
// constraint was self-imposed and not worth the correctness cost.
export function compareVersions(a, b) {
  const left = String(a);
  const right = String(b);
  // Unorderable input sorts equal rather than throwing: callers compare audit
  // findings, and one malformed version should not abort the whole check.
  if (!semver.valid(left) || !semver.valid(right)) return 0;
  return semver.compare(left, right);
}

// Does an override key's selector actually match this installed version?
//
// This is the question the stale-pin check never asks. `uuid@9.0.1` selects one
// version and nothing else, so it can never apply to an installed 8.3.2, which
// is precisely how three vulnerable uuid copies stayed put behind a patched pin.
//
// A null selector is a blanket override and covers everything. A selector
// semver cannot parse as a range returns true, so an unusual key produces
// silence rather than a false alarm; the stale-pin check still covers that key
// on its own.
export function selectorCovers(selector, version) {
  if (!selector) return true;
  const trimmed = selector.trim();
  if (!semver.valid(version)) return true;
  if (!semver.validRange(trimmed)) return true;
  // includePrerelease is deliberately NOT set: semver keeps a prerelease out of
  // an ordinary range, and so does pnpm, so `pkg@<2.0.0` genuinely would not be
  // applied to 1.2.3-alpha.1. A selector naming a prerelease still matches its
  // own, which is what `semver.satisfies` does by default.
  return semver.satisfies(version, trimmed);
}

export function overrideKeyCovers(key, version, paths = null) {
  if (!paths || paths.length === 0) return overrideKeyCoversPath(key, version, null);
  return paths.every((path) => overrideKeyCoversPath(key, version, path));
}

// The version-level question, asked with the quantifiers the right way round:
// a version is covered when EVERY path it arrives by is covered by SOME key.
export function versionIsCovered(pins, version, paths) {
  if (!paths || paths.length === 0) {
    return pins.some((pin) => overrideKeyCoversPath(pin.key, version, null));
  }
  return paths.every((path) => pins.some((pin) => overrideKeyCoversPath(pin.key, version, path)));
}

export function overrideKeyCoversPath(key, version, path) {
  const { name, selector, parent } = splitOverrideKey(key);
  if (!selectorCovers(selector, version)) return false;
  if (!parent) return true;
  if (!path) return true;

  // A pnpm parent selector overrides the matched parent's OWN dependency, so
  // `foo>child` cannot reach a child that some intermediate package depends on:
  // in 'app > foo > intermediate > child@1.0.0' the direct parent is
  // `intermediate`, not `foo`. Requiring adjacency keeps a patched pin from
  // suppressing a copy the override never rewrites.
  //
  // Segments are compared as package identities rather than substrings, so
  // `foo` does not match a `foobar` segment.
  const { name: parentName, selector: parentSelector } = splitOverrideKey(parent);
  const segments = String(path)
    .split('>')
    .map((segment) => segment.trim());

  // A version-scoped parent key only applies when the parent's own version
  // satisfies that selector, so `foo@1>child` must not be credited for a path
  // through foo@2.0.0. Where the path carries no version for the segment there
  // is nothing to disprove, so the selector passes.
  const isParent = (segment) => {
    if (segment !== parentName && !segment.startsWith(`${parentName}@`)) return false;
    if (!parentSelector) return true;
    const at = segment.indexOf('@', segment.startsWith('@') ? 1 : 0);
    if (at === -1) return true;
    return selectorCovers(parentSelector, segment.slice(at + 1));
  };
  const isChild = (segment) => segment === name || segment.startsWith(`${name}@`);

  return segments.some((segment, i) => isParent(segment) && isChild(segments[i + 1] ?? ''));
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

// An uncovered-copy finding is not identified by a pinned version - the pin is
// fine, the key is not - so it is keyed on the versions left uncovered. Stale-pin
// entries keep their original shape so existing baseline records still match.
export function baselineKey(finding) {
  if (finding.kind === 'uncovered-copy') {
    // Sorted, because the versions arrive in whatever order pnpm audit listed
    // its findings. An unsorted join would make an accepted entry go stale the
    // day that order changes, failing CI on an advisory nobody touched.
    const versions = [...finding.uncovered].sort((a, b) => a.localeCompare(b));
    return `${finding.package}@uncovered:${versions.join(',')}:${finding.advisory}`;
  }
  return `${finding.package}@${finding.pinned}:${finding.advisory}`;
}

// The key a human should paste into package.json to actually cover the copies
// that are currently escaping. `<fixedIn` is the honest bound: everything below
// the first patched release needs forcing up to it.
//
// Only offered for a simple lower-bounded patched range. A disjoint range such
// as '<2.0.0 || >=2.0.5' has no single such bound - suggesting "<2.0.0": "2.0.0"
// there would both miss a vulnerable 2.0.3 and pin copies to a version outside
// the patched set. Better to print no suggestion and let the advisory be read.
const SIMPLE_PATCHED_RANGE = /^\s*>=\s*v?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?\s*$/;

export function suggestRangeKey(packageName, fixedIn, patchedVersions = '') {
  if (!fixedIn) return null;
  if (patchedVersions && !SIMPLE_PATCHED_RANGE.test(patchedVersions)) return null;
  return `"${packageName}@<${fixedIn}": "${fixedIn}"`;
}

// Cross-reference the overrides against the audited tree.
export function findVulnerablePins(overrides, audit) {
  const index = indexOverrides(overrides);
  const findings = [];

  for (const advisory of Object.values(audit?.advisories ?? {})) {
    const pins = index.get(advisory.module_name);
    if (!pins) continue; // not overridden - a plain dependabot bump fixes it

    const installed = [...new Set((advisory.findings ?? []).map((f) => f.version).filter(Boolean))];

    // Second class of finding: the pins may all be patched, yet none of the
    // override KEYS selects the copies that are actually vulnerable, so the
    // override never applies to them. Reported once per advisory rather than
    // once per pin, because it is the key set as a whole that fell short.
    //
    // A version equal to one of the pinned values is excluded first. An override
    // rewrites resolution TO its pinned value, so that version being installed
    // is proof the override applied - and an exact-version key never selects its
    // own target ('vite@7.3.3': '7.3.5' installs 7.3.5, which 'vite@7.3.3' does
    // not match). Without this, every ordinary stale pin would also be reported
    // as an uncovered copy, with remediation prose contradicting the stale-pin
    // finding printed beside it. That case is already covered, correctly, by the
    // stale-pin check below.
    const pinnedValues = new Set(pins.map((pin) => pin.pinned));
    const pathsByVersion = new Map();
    for (const entry of advisory.findings ?? []) {
      if (!entry?.version) continue;
      const seen = pathsByVersion.get(entry.version) ?? [];
      pathsByVersion.set(entry.version, seen.concat(entry.paths ?? []));
    }
    const uncovered = installed.filter(
      (version) =>
        !pinnedValues.has(version) && !versionIsCovered(pins, version, pathsByVersion.get(version))
    );
    if (uncovered.length > 0) {
      const fixedIn = fixedVersionFrom(advisory.patched_versions);
      findings.push({
        kind: 'uncovered-copy',
        package: advisory.module_name,
        overrideKey: pins.map((pin) => pin.key).join(', '),
        pinned: [...new Set(pins.map((pin) => pin.pinned))].join(', '),
        pinIsRange: false,
        installed,
        uncovered,
        suggestedKey: suggestRangeKey(advisory.module_name, fixedIn, advisory.patched_versions),
        advisory: advisoryId(advisory),
        severity: advisory.severity ?? 'unknown',
        title: advisory.title ?? '',
        vulnerableVersions: advisory.vulnerable_versions ?? 'unknown',
        patchedVersions: advisory.patched_versions ?? '',
        fixedIn,
        url: advisory.url ?? '',
      });
    }

    for (const pin of pins) {
      const exact = isExactVersion(pin.pinned);
      // An exact pin is vulnerable when the tree actually resolved to it. A
      // range pin cannot be compared without a semver engine, so any vulnerable
      // copy of an overridden package is reported and the range is shown.
      const hit = exact ? installed.includes(pin.pinned) : installed.length > 0;
      if (!hit) continue;

      findings.push({
        kind: 'stale-pin',
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
//
// An uncovered-copy entry is keyed on the uncovered versions instead, and
// expires the same way: cover one of them, or let a new copy appear, and the
// entry stops matching. Entries are run through the same baselineKey() the
// findings use, so the two can never drift apart.
export function applyBaseline(findings, baseline) {
  const accepted = new Map(
    (baseline?.accepted ?? []).map((entry) => [
      baselineKey({
        kind: entry.kind ?? 'stale-pin',
        package: entry.package,
        pinned: entry.pinned,
        uncovered: entry.uncovered ?? [],
        advisory: entry.advisory,
      }),
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
  const uncoveredCopy = finding.kind === 'uncovered-copy';
  const lines = [
    `  ${finding.package}  [${finding.severity}]` +
      (uncoveredCopy ? '  - vulnerable copies no override key covers' : ''),
    uncoveredCopy
      ? `    override keys: ${JSON.stringify(finding.overrideKey)}`
      : `    override key:  ${JSON.stringify(finding.overrideKey)}`,
    `    pinned at:     ${finding.pinned}${finding.pinIsRange ? ' (range, not an exact pin)' : ''}`,
    `    installed:     ${finding.installed.join(', ') || 'unknown'}`,
  ];
  if (uncoveredCopy) {
    lines.push(`    NOT covered:   ${finding.uncovered.join(', ')}`);
  }
  lines.push(`    advisory:      ${finding.advisory}`);
  if (finding.title) lines.push(`    title:         ${finding.title}`);
  lines.push(`    vulnerable:    ${finding.vulnerableVersions}`);
  lines.push(
    finding.fixedIn
      ? `    fixed in:      ${finding.fixedIn}  (patched range ${finding.patchedVersions})`
      : `    fixed in:      no patched version published (${finding.patchedVersions || 'none'})`
  );
  if (uncoveredCopy && finding.suggestedKey) {
    lines.push(`    suggested key: ${finding.suggestedKey}`);
  }
  if (finding.url) lines.push(`    url:           ${finding.url}`);
  return lines.join('\n');
}

// --- I/O --------------------------------------------------------------------

function readJson(file, label) {
  let raw;
  try {
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

  const stalePins = findings.filter((finding) => finding.kind !== 'uncovered-copy');
  const uncoveredCopies = findings.filter((finding) => finding.kind === 'uncovered-copy');

  console.log(`check-override-advisories: ${overrideCount} override entries checked`);
  console.log(`  advisories in tree:  ${Object.keys(audit.advisories ?? {}).length}`);
  console.log(`  vulnerable pins:     ${stalePins.length}`);
  console.log(`  uncovered copies:    ${uncoveredCopies.length}`);
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
    // Deliberately phrased as "nothing unreviewed" rather than "everything is
    // patched". Baselined findings are still live vulnerabilities, and claiming
    // they are patched would contradict the accepted-drift block printed just
    // above it.
    console.log(
      known.length > 0
        ? `\ncheck-override-advisories: OK - no unreviewed findings (${known.length} accepted in the baseline, still vulnerable)`
        : '\ncheck-override-advisories: OK - every override pins a patched version and covers ' +
            'every vulnerable copy'
    );
    return 0;
  }

  const unacceptedStale = unaccepted.filter((finding) => finding.kind !== 'uncovered-copy');
  const unacceptedUncovered = unaccepted.filter((finding) => finding.kind === 'uncovered-copy');
  const parts = [];
  if (unacceptedStale.length > 0) {
    parts.push(
      `${unacceptedStale.length} override entr${unacceptedStale.length === 1 ? 'y pins' : 'ies pin'} ` +
        'a version with a known advisory'
    );
  }
  if (unacceptedUncovered.length > 0) {
    parts.push(
      `${unacceptedUncovered.length} advisor${unacceptedUncovered.length === 1 ? 'y has' : 'ies have'} ` +
        'a vulnerable copy that no override key covers'
    );
  }
  console.error(`\ncheck-override-advisories: ${parts.join(', and ')}\n`);

  for (const finding of unaccepted) {
    console.error(formatFinding(finding));
    console.error('');
  }

  if (unacceptedStale.length > 0) {
    console.error(
      'For a stale pin, raise the value in the pnpm.overrides block of package.json to the ' +
        "'fixed in' version above, then re-run pnpm install. Bumping the dependent " +
        'package alone will not work: the override pins resolution regardless.'
    );
  }
  if (unacceptedUncovered.length > 0) {
    const withSuggestion = unacceptedUncovered.filter((finding) => finding.suggestedKey);
    console.error(
      'For an uncovered copy, the override KEY is too narrow to select the versions listed under ' +
        '"NOT covered", so the override never applies to them.'
    );
    if (withSuggestion.length > 0) {
      console.error(
        'Where a "suggested key" is printed, the pinned value is already patched: replace the ' +
          'narrow keys with that range key and re-run pnpm install.'
      );
    }
    // Without a suggestion there is no release to pin to, so telling anyone to
    // paste a range key would be advice that cannot be followed - and the pin
    // itself may still be vulnerable.
    if (withSuggestion.length < unacceptedUncovered.length) {
      console.error(
        'Where none is printed, the advisory publishes no single patched release to pin to ' +
          '(no fix, a disjoint range, or an exclusive bound). Read the advisory and either raise ' +
          'the dependency that pulls the copy in, drop it, or record it in the baseline.'
      );
    }
  }
  console.error(
    'If a fix is genuinely blocked, record it in ' +
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
