#!/usr/bin/env node
/**
 * Fails when frontend source gains a hardcoded colour.
 *
 * The design system declares its colours once, in `apps/frontend/src/app/globals.css`
 * and `packages/design-tokens`, and every consumer is meant to reach them through a
 * custom property. A colour written as a literal in feature code is invisible to
 * that system: it does not flip with the theme, it does not move when the token
 * moves, and no contrast guard that reads the token file can see it. Five of
 * today's contrast fixes were literals that had drifted from the token they were
 * copied from.
 *
 * WHY A BASELINE AND NOT A BAN
 *
 * There are hundreds of literals on `dev` already. A gate that fails on all of
 * them cannot be merged, and a gate narrowed to whatever is already clean is not
 * a gate. So the baseline records the count per file, CI fails on any INCREASE,
 * and it fails just as loudly when a file improves without the baseline being
 * retightened - a ratchet that only ever loosens is a document. `--update` is the
 * one way to move it, and moving it up shows as an addition in the diff.
 *
 * WHAT IS NOT A FINDING, AND WHY IT MATTERS MORE THAN WHAT IS
 *
 * Comments are stripped before matching. Half the literals in this repository sit
 * inside a comment explaining why the shipped colour is what it is - `#8b8173
 * passed only on --spot`, `#007cf5 is only 4.04:1`. Those sentences are the
 * record of a decision. A gate that counted them would be answered by deleting
 * them, which costs the repository the reasoning and gains it nothing. Stripping
 * comments is therefore not a convenience; it is the difference between a gate
 * that improves the code and one that erases its explanations.
 *
 * Strings are NOT stripped, because that is where the violations live
 * (`color: '#E9F2FD'`). Comment detection consequently has to know it is inside a
 * string, or the `//` in an `https://` URL blanks the rest of the line and the
 * scan silently under-reports.
 *
 * Usage:
 *   node scripts/ci/check-hardcoded-colours.mjs             scan against the baseline
 *   node scripts/ci/check-hardcoded-colours.mjs --update    rewrite the baseline
 *   node scripts/ci/check-hardcoded-colours.mjs --list      print every finding
 *   node scripts/ci/check-hardcoded-colours.mjs selftest    prove the scanner can find one
 *
 * Exit 0 clean. Exit 1 the gate ran and something failed it. Exit 2 the gate
 * could not run - no baseline, an empty walk, a failed selftest. A caller that
 * treats 2 as clean has removed the gate.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative, resolve, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');

export const BASELINE_PATH = join(repoRoot, 'scripts/ci/hardcoded-colours-baseline.json');

/** Roots that are scanned, relative to the repository root. */
export const SCAN_ROOTS = ['apps/frontend/src'];

/** Extensions carrying colours a human wrote. */
const EXTENSIONS = ['.ts', '.tsx', '.css'];

/**
 * Paths the gate does not read, and the reason each one is out of scope.
 *
 * `globals.css` and `packages/design-tokens` are where a literal BELONGS - they
 * are the declaration site the rest of the codebase is supposed to point at.
 * Tests are excluded because a test that pins a colour is often asserting the
 * arithmetic on a specific literal, which is a legitimate thing to write down.
 * Stories are IN scope: a story is rendered code, and a literal in one is a
 * literal a component can be built from.
 */
const EXCLUDED = [
  (p) => p.includes(`${sep}__tests__${sep}`),
  (p) => /\.test\.(ts|tsx)$/.test(p),
  (p) => p.endsWith(`app${sep}globals.css`),
  (p) => p.includes(`${sep}node_modules${sep}`),
];

/**
 * A scan that walks nothing returns clean, so the walk asserts its own size.
 * The frontend has well over a thousand in-scope files; this only has to be
 * high enough that an empty or mis-rooted walk cannot pass as a clean one.
 */
const MIN_FILES = 200;

/* The boundary is `\w`, not `[0-9a-fA-F\w]`: `\w` already contains the hex
   digits, so the longer form is the same automaton written twice and reads as
   if it constrained something extra. What keeps `#1657c9ff` ONE finding rather
   than two is the order of the alternation plus this boundary, not the range
   inside it - the eight-digit selftest case is what holds that. */
const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?!\w)/g;
// Anchored on a DIGIT as the first argument so `rgb(var(--x) / 0.5)` - a token
// use, not a literal - is not a finding, and carried to the closing paren so
// the failure message shows the whole colour rather than `rgba(0`.
const FUNCTIONAL = /\b(?:rgba?|hsla?)\(\s*[\d.][^)]*\)/g;

class GateError extends Error {}

/**
 * Blanks comments, leaving every other byte and every newline in place so line
 * numbers and column offsets still refer to the file on disk.
 *
 * The state machine exists for one reason: `//` inside a string is not a
 * comment. `'https://example.com/#abc'` and a template literal holding a URL are
 * both common, and a regex-only strip turns the rest of that line into nothing.
 */
export const stripComments = (source, { lineComments = true } = {}) => {
  const out = [...source];
  let i = 0;
  let state = 'code'; // code | line | block | single | double | template
  while (i < source.length) {
    const c = source[i];
    const next = source[i + 1];
    if (state === 'code') {
      if (lineComments && c === '/' && next === '/') {
        state = 'line';
        out[i] = ' ';
        out[i + 1] = ' ';
        i += 2;
        continue;
      }
      if (c === '/' && next === '*') {
        state = 'block';
        out[i] = ' ';
        out[i + 1] = ' ';
        i += 2;
        continue;
      }
      if (c === "'") state = 'single';
      else if (c === '"') state = 'double';
      else if (c === '`') state = 'template';
      i += 1;
      continue;
    }
    if (state === 'line') {
      if (c === '\n') state = 'code';
      else out[i] = ' ';
      i += 1;
      continue;
    }
    if (state === 'block') {
      if (c === '*' && next === '/') {
        out[i] = ' ';
        out[i + 1] = ' ';
        state = 'code';
        i += 2;
        continue;
      }
      if (c !== '\n') out[i] = ' ';
      i += 1;
      continue;
    }
    // Inside a string: only its own terminator, or an escape, matters.
    if (c === '\\') {
      i += 2;
      continue;
    }
    if (
      (state === 'single' && c === "'") ||
      (state === 'double' && c === '"') ||
      (state === 'template' && c === '`') ||
      (state !== 'template' && c === '\n')
    ) {
      state = 'code';
    }
    i += 1;
  }
  return out.join('');
};

/**
 * Every colour literal in one file's source, as `{ line, text }`.
 *
 * `//` is a comment in TypeScript and is NOT one in CSS, where the same two
 * characters appear in every absolute `url(https://...)`. Treating CSS the same
 * way would blank the rest of that line and quietly lower the count, so the
 * comment style follows the file.
 */
export const findColours = (source, { css = false } = {}) => {
  const stripped = stripComments(source, { lineComments: !css });
  const findings = [];
  /* Matched over the WHOLE file rather than line by line. Prettier hard-wraps a
     long declaration inside the parens - `rgba(29, 28, 27,\n  0.05)` - and a
     line-oriented scan sees an opening with no closing paren on either line and
     reports neither. It is the failure mode where the gate keeps returning a
     clean, plausible number while the corpus it was pointed at grew. */
  for (const pattern of [HEX, FUNCTIONAL]) {
    pattern.lastIndex = 0;
    let m;
    while ((m = pattern.exec(stripped)) !== null) {
      const line = stripped.slice(0, m.index).split('\n').length;
      findings.push({ line, text: m[0].replace(/\s+/g, ' ') });
    }
  }
  return findings.sort((a, b) => a.line - b.line);
};

/**
 * `maxDepth` guards against unbounded stack growth, and is not a scan limit:
 * the deepest path under `apps/frontend/src` is nowhere near it. A tree that
 * DID reach the cap would be silently under-scanned, which is the one failure
 * this gate cannot see in its own output, so it throws rather than returning
 * the partial list as though it were the whole corpus.
 */
const walk = (dir, acc = [], depth = 0, maxDepth = 100) => {
  if (depth >= maxDepth) {
    throw new GateError(`walk exceeded ${maxDepth} levels at ${relative(repoRoot, dir)}`);
  }
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules') continue;
      walk(full, acc, depth + 1, maxDepth);
      continue;
    }
    if (!EXTENSIONS.some((ext) => full.endsWith(ext))) continue;
    if (EXCLUDED.some((skip) => skip(full))) continue;
    acc.push(full);
  }
  return acc;
};

/** `{ counts: { path: n }, findings: [{ file, line, text }], scanned: n }`. */
export const scan = (roots = SCAN_ROOTS) => {
  const files = [];
  for (const root of roots) {
    /* Resolved, then checked to still be INSIDE the repository, so a root
       carrying `..` cannot walk the gate out of the tree it is meant to hold. */
    const abs = resolve(repoRoot, root);
    const contained = relative(resolve(repoRoot), abs);
    if (contained.startsWith('..') || isAbsolute(contained)) {
      throw new GateError(`scan root escapes the repository: ${root}`);
    }
    if (!existsSync(abs)) throw new GateError(`scan root does not exist: ${root}`);
    walk(abs, files);
  }
  const counts = {};
  const findings = [];
  for (const file of files) {
    const rel = relative(repoRoot, file);
    for (const hit of findColours(readFileSync(file, 'utf8'), { css: file.endsWith('.css') })) {
      findings.push({ file: rel, ...hit });
      counts[rel] = (counts[rel] ?? 0) + 1;
    }
  }
  return { counts, findings, scanned: files.length };
};

/**
 * Compares a scan against the baseline.
 *
 * Three failures, kept apart because they call for different actions: a file
 * that gained literals is a change to fix, a file that lost them is a baseline
 * to retighten, and a baselined file that no longer exists is a stale entry.
 */
export const compare = (counts, baseline, justified = {}) => {
  const increased = [];
  const decreased = [];
  const vanished = [];
  const drifted = [];
  for (const [file, n] of Object.entries(counts)) {
    if (file in justified) continue;
    const allowed = baseline[file] ?? 0;
    if (n > allowed) increased.push({ file, was: allowed, now: n });
  }
  for (const [file, allowed] of Object.entries(baseline)) {
    if (file in justified) continue;
    const n = counts[file] ?? 0;
    if (!existsSync(join(repoRoot, file))) vanished.push({ file, was: allowed });
    else if (n < allowed) decreased.push({ file, was: allowed, now: n });
  }
  /* A justified file is pinned in BOTH directions. A ceiling would let a new
     literal hide behind a reason written for a different one, which is the one
     way an allowlist silently becomes an exemption. */
  for (const [file, entry] of Object.entries(justified)) {
    if (!existsSync(join(repoRoot, file))) {
      vanished.push({ file, was: entry.n });
      continue;
    }
    const n = counts[file] ?? 0;
    if (n !== entry.n) drifted.push({ file, was: entry.n, now: n, why: entry.why });
  }
  return { increased, decreased, vanished, drifted };
};

/**
 * `{ files, justified }`.
 *
 * `files` is debt: literals that should become tokens, counted per file so the
 * gate can fail on an increase. `justified` is the other kind, and it is the
 * reason this gate can honestly aim at zero. Some literals are correct and
 * removing them is the regression: a third party's brand colour handed to an
 * iframe that cannot read our custom properties, a `<style>` string injected
 * into a print window that has none of our CSS, a knob that must NOT flip with
 * the theme because the surface behind it does not.
 *
 * An entry without a `why` is rejected rather than skipped. An allowlist whose
 * entries carry no reason is indistinguishable from the drift this gate exists
 * to stop, and it is the shape every such list decays into.
 */
const readBaseline = () => {
  if (!existsSync(BASELINE_PATH)) {
    throw new GateError(`no baseline at ${relative(repoRoot, BASELINE_PATH)}`);
  }
  const parsed = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  const justified = parsed.justified ?? {};
  for (const [file, entry] of Object.entries(justified)) {
    if (!entry || typeof entry.why !== 'string' || entry.why.trim().length < 20) {
      throw new GateError(
        `justified entry for ${file} has no usable "why". An allowlist entry ` +
          'without a reason is the drift this gate exists to stop.'
      );
    }
    if (!Number.isInteger(entry.n) || entry.n < 1) {
      throw new GateError(`justified entry for ${file} has no positive "n"`);
    }
  }
  return { files: parsed.files ?? {}, justified };
};

/**
 * `--update` rewrites the debt and CARRIES the justifications through unchanged,
 * with their counts re-read from disk. It can never move a file INTO `justified`
 * - a reason is written by a person, and a generated one would be a sentence
 * nobody chose.
 */
const writeBaseline = (counts, scanned, justified = {}) => {
  const files = Object.fromEntries(
    Object.entries(counts)
      .filter(([file]) => !(file in justified))
      .sort(([a], [b]) => a.localeCompare(b))
  );
  const carried = Object.fromEntries(
    Object.entries(justified)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([file, entry]) => [file, { n: counts[file] ?? 0, why: entry.why }])
  );
  const total = Object.values(files).reduce((n, c) => n + c, 0);
  writeFileSync(
    BASELINE_PATH,
    `${JSON.stringify({ generated_by: 'scripts/ci/check-hardcoded-colours.mjs --update', total, justified: carried, files }, null, 2)}\n`
  );
  return { total, fileCount: Object.keys(files).length, scanned };
};

/**
 * Proves the scanner can return something other than zero.
 *
 * Every assertion here is planted rather than read off the tree, because the
 * corpus is the thing under test: a scanner that finds nothing and a tree that
 * holds nothing produce the same clean run.
 */
export const SELFTEST_CASES = [
  ['const a = { color: "#ff0000" };', 1, 'hex in a string'],
  ['const a = { color: "#f00" };', 1, 'short hex'],
  ['background: rgba(12, 34, 56, 0.5);', 1, 'rgba'],
  ['color: hsl(210, 50%, 40%);', 1, 'hsl'],
  ['/* #ff0000 was rejected: 3.1:1 */', 0, 'hex inside a block comment'],
  ['// #ff0000 was rejected', 0, 'hex inside a line comment'],
  ['const u = "https://example.com/a#ff0000";', 1, 'hex-looking URL fragment is still a literal'],
  ['const u = "https://example.com/docs"; // see #2822', 0, 'issue reference is not a colour'],
  ['const c = "var(--blue-strong)";', 0, 'a token is the whole point'],
  ['const c = "var(--blue, #257bed)";', 1, 'a literal fallback pins a stale colour'],
  ['const u = "https://x.test"; const c = "#abc";', 1, 'a URL does not blank the rest of the line'],
  [
    'a { background: url(https://x.test/i.png); color: #ff0000; }',
    1,
    'css: a url is not a comment',
    { css: true },
  ],
  [
    'a {\n  box-shadow:\n    0 1px 2px rgba(29, 28, 27,\n    0.05);\n}',
    1,
    'css: a functional colour hard-wrapped by prettier is still one finding',
    { css: true },
  ],
  [
    'const s = {\n  boxShadow: `0 8px 22px rgba(29, 28,\n    27, 0.05)`,\n};',
    1,
    'ts: a functional colour wrapped inside a template literal is one finding',
  ],
  [
    'a { /* #ff0000 rejected */ color: var(--blue); }',
    0,
    'css: hex inside a block comment',
    { css: true },
  ],
];

export const selftest = () => {
  const failures = [];
  for (const [source, expected, label, options] of SELFTEST_CASES) {
    const got = findColours(source, options).length;
    if (got !== expected) failures.push(`${label}: expected ${expected}, got ${got}`);
  }
  return failures;
};

const main = () => {
  const args = process.argv.slice(2);
  if (args.includes('selftest')) {
    const failures = selftest();
    for (const f of failures) console.error(`selftest: ${f}`);
    if (failures.length) return 2;
    console.log(`selftest: ${SELFTEST_CASES.length} cases pass`);
    return 0;
  }

  const { counts, findings, scanned } = scan();
  if (scanned < MIN_FILES) {
    console.error(
      `could not run: walked ${scanned} files, expected at least ${MIN_FILES}. ` +
        'An empty or mis-rooted walk reports clean, so this is an error and not a pass.'
    );
    return 2;
  }
  const selftestFailures = selftest();
  if (selftestFailures.length) {
    for (const f of selftestFailures) console.error(`selftest: ${f}`);
    console.error('could not run: the scanner failed its own cases, so its count means nothing.');
    return 2;
  }

  if (args.includes('--list')) {
    for (const f of findings) console.log(`${f.file}:${f.line}  ${f.text}`);
  }

  const { files: baseline, justified } = readBaseline();

  if (args.includes('--update')) {
    const { total, fileCount } = writeBaseline(counts, scanned, justified);
    console.log(
      `baseline written: ${total} colour literals across ${fileCount} files ` +
        `(${scanned} files scanned)`
    );
    return 0;
  }

  const { increased, decreased, vanished, drifted } = compare(counts, baseline, justified);

  if (increased.length) {
    console.error('New hardcoded colours. Use a token from globals.css instead:\n');
    for (const { file, was, now } of increased) {
      console.error(`  ${file}: ${was} -> ${now}`);
      for (const f of findings.filter((x) => x.file === file)) {
        console.error(`      ${f.line}: ${f.text}`);
      }
    }
  }
  if (decreased.length) {
    console.error(
      '\nColours were removed without retightening the baseline. Run:\n' +
        '  node scripts/ci/check-hardcoded-colours.mjs --update\n'
    );
    for (const { file, was, now } of decreased) console.error(`  ${file}: ${was} -> ${now}`);
  }
  if (vanished.length) {
    console.error('\nBaselined files that no longer exist. Run --update:\n');
    for (const { file, was } of vanished) console.error(`  ${file} (was ${was})`);
  }
  if (drifted.length) {
    console.error(
      '\nA file with a justified literal changed count. The reason on record was\n' +
        'written for the literals that were there; re-read it and either fix the\n' +
        'new one or widen the reason deliberately:\n'
    );
    for (const { file, was, now, why } of drifted) {
      console.error(`  ${file}: ${was} -> ${now}\n      reason on record: ${why}`);
    }
  }
  if (increased.length || decreased.length || vanished.length || drifted.length) return 1;

  const debt = Object.entries(counts)
    .filter(([file]) => !(file in justified))
    .reduce((n, [, c]) => n + c, 0);
  const kept = Object.values(justified).reduce((n, e) => n + e.n, 0);
  console.log(
    `no new hardcoded colours: ${debt} to migrate across ` +
      `${Object.keys(counts).length - Object.keys(justified).length} files, ` +
      `${kept} justified across ${Object.keys(justified).length} files, ` +
      `${scanned} files scanned`
  );
  return 0;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.exit(main());
  } catch (error) {
    console.error(`could not run: ${error instanceof GateError ? error.message : error}`);
    process.exit(2);
  }
}
