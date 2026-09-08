#!/usr/bin/env node
/* Versioned UI freeze measurements. All counts use one ref and one frontend
 * source corpus so adoption figures remain comparable in CI.
 *
 * Every exported function takes its `git` runner as an argument. That is not
 * ceremony: the guard this file exists to enforce - "the primitive directory is
 * missing, so the adoption figure is unmeasured rather than zero" - can only be
 * tested by a control that travels the same call path as the measurement, and
 * an in-script selftest that hand-throws the error it asserts on cannot. */
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const CORPUS = 'apps/frontend/src/app/';

export const gitIn =
  (root) =>
  (...args) =>
    execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' });

/* Raw-usage patterns anchor to a JSX tag name rather than to the bare word.
 * `Modal|Dialog|Sheet|Popover` matched 2533 identifier substrings - setShowModal,
 * showModal, appointmentCentralModalUtils - for every 286 standalone words, so
 * 39 of the 68 files it called "remaining" contained no overlay at all. The
 * leading (^|[^A-Za-z0-9_]) is the second half of the fix: a generic argument is
 * also a `<` followed by a name, and without it useRef<HTMLDialogElement> and
 * Partial<GroupModalProps> count as overlays. */
export const tagName = (...words) => `(^|[^A-Za-z0-9_])<[A-Za-z0-9]*(${words.join('|')})`;

export const adoption = [
  ['Buttons', 'ui/primitives/Buttons', '<button', '<button type="button">'],
  [
    'SegmentedPill',
    'ui/primitives/SegmentedPill',
    'role=[\\x27"]group[\\x27"]',
    '<div role="group">',
  ],
  [
    'PanelStates',
    'ui/primitives/PanelStates',
    tagName('EmptyState', 'ErrorState', 'LoadingState'),
    '<EmptyState title="No results" />',
  ],
  ['Overlays', 'ui/overlays', tagName('Modal', 'Dialog', 'Sheet', 'Popover'), '<Modal open />'],
  [
    'StatusPill',
    'ui/primitives/StatusPill',
    tagName('Badge', 'StatusBadge'),
    '<Badge>Ready</Badge>',
  ],
];

const inCorpus = (file, exclude) =>
  (!exclude || !file.includes('/ui/primitives/')) &&
  !file.includes('.stories.') &&
  !file.includes('__tests__');

export const matchingFiles = (git, ref, pattern, path = CORPUS, exclude = true) => {
  try {
    return git('grep', '-lE', pattern, ref, '--', path)
      .trim()
      .split('\n')
      .filter(Boolean)
      .filter((file) => inCorpus(file, exclude));
  } catch (error) {
    if (error.status === 1) return [];
    throw error;
  }
};

/* The oracle: the primitive's own directory. Empty means the family cannot be
 * measured on this ref at all, which is a different answer from 0% adoption. */
export const oracleFiles = (git, ref, name, marker) => {
  const files = git('ls-tree', '-r', '--name-only', ref, '--', `${CORPUS}${marker}/`)
    .trim()
    .split('\n')
    .filter(Boolean);
  if (files.length === 0) throw new Error(`${name}: adoption oracle is unmeasured`);
  return files;
};

export const measure = (name, raw, fixture, usingFiles, rawFiles) => {
  if (!fixture || !new RegExp(raw).test(fixture))
    throw new Error(`${name}: bypass pattern is stale`);
  const using = new Set(usingFiles);
  const bypassing = rawFiles.filter((file) => !using.has(file)).length;
  if (rawFiles.length > 0 && bypassing === 0)
    throw new Error(`${name}: bypass pattern only matches primitive consumers`);
  const total = using.size + bypassing;
  if (total === 0) throw new Error(`${name}: adoption is unmeasured`);
  return { using: using.size, bypassing, total, adoption: Math.round((using.size / total) * 100) };
};

export const corpusSize = (git, ref) =>
  git('ls-tree', '-r', '--name-only', ref, '--', CORPUS)
    .trim()
    .split('\n')
    .filter((file) => file.endsWith('.tsx') && inCorpus(file, true)).length;

export const scorecard = (git, ref) =>
  adoption.map(([name, marker, raw, fixture]) => {
    oracleFiles(git, ref, name, marker);
    const usingFiles = matchingFiles(git, ref, `(from|import)[[:space:]][^[:space:]]*${marker}`);
    return [name, measure(name, raw, fixture, new Set(usingFiles), matchingFiles(git, ref, raw))];
  });

/* Units travel with the number. Two separate errors in this file's review were a
 * numerator and a denominator drawn from different populations, and no line of
 * output said which population it meant. */
export const report = (ref, size, rows) => [
  `UI freeze adoption @ ${ref}`,
  ...rows.map(
    ([name, r]) =>
      `  ${name}: ${r.using}/${r.total} files migrated (${r.adoption}%), ${r.bypassing} files remaining` +
      ` [unit: files; corpus ${size} .tsx in ${CORPUS}, excl. ui/primitives, stories, __tests__]`
  ),
];

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const ref = process.argv[2] ?? 'origin/dev';
  const git = gitIn(new URL('../..', import.meta.url).pathname);
  const rows = scorecard(git, ref);
  for (const line of report(git('rev-parse', '--short', ref).trim(), corpusSize(git, ref), rows))
    console.log(line);
}
