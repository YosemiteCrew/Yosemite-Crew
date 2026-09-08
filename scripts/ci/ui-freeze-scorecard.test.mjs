// Tests for the UI freeze scorecard. The file this replaces carried four
// "negative controls" inside a --selftest flag; one of them hand-threw the error
// it then asserted on, so it stayed green when the guard it named was deleted
// outright. Nothing in .github ever ran that flag either. These run under
// `pnpm test:scripts`, which _core.yaml does run.
//
// The oracle control below uses the real repository and the real git runner, on
// purpose: the defect it guards is "the primitive directory is gone, so the
// figure is unmeasured rather than 0%", and only a control that reaches ls-tree
// can fail when that check is removed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  adoption,
  corpusSize,
  gitIn,
  matchesRaw,
  matchingFiles,
  measure,
  oracleFiles,
  report,
  scorecard,
  tagName,
  CORPUS,
} from './ui-freeze-scorecard.mjs';

const repo = new URL('../..', import.meta.url).pathname;
const git = gitIn(repo);
const ref = 'HEAD';

/** A git stub: every call returns `lines`, joined the way git does. */
const stubGit = (lines) => () => `${lines.join('\n')}\n`;

test('the oracle refuses to report on a marker directory that is not there', () => {
  assert.throws(
    () => oracleFiles(git, ref, 'PanelStates', 'ui/primitives/NotAPrimitive'),
    /PanelStates: adoption oracle is unmeasured/
  );
});

test('the same call on a marker that IS there returns files', () => {
  // The discriminator for the case above. Without it, a broken git runner that
  // returned '' for everything would satisfy the throw and prove nothing.
  const files = oracleFiles(git, ref, 'Buttons', 'ui/primitives/Buttons');
  assert.ok(files.length > 0);
  assert.ok(files.every((file) => file.startsWith(`${CORPUS}ui/primitives/Buttons/`)));
});

// Was `new RegExp(raw).test(fixture)`, which is not the dialect that selects any
// file. Under ERE the shipped SegmentedPill pattern was a different pattern.
test('every shipped family pattern still matches its own fixture, in ERE', () => {
  for (const [name, , raw, fixture] of adoption)
    assert.ok(matchesRaw(raw, fixture), `${name}: fixture no longer matches under ERE`);
});

test('the two dialects disagree, and the shipped patterns are written in ERE', () => {
  const jsOnly = 'role=[\\x27"]group[\\x27"]';
  const ere = adoption.find(([name]) => name === 'SegmentedPill')[2];
  // Control: the two spellings are not the same string, and JS reads both the
  // same way - which is exactly why a JS-dialect guard could not tell them apart.
  assert.notEqual(jsOnly, ere);
  for (const pattern of [jsOnly, ere])
    assert.equal(new RegExp(pattern).test("<div role='group'>"), true, pattern);
  // ERE is where they part: the backslash inside a bracket expression is literal.
  assert.equal(matchesRaw(jsOnly, "<div role='group'>"), false);
  assert.equal(matchesRaw(ere, "<div role='group'>"), true);
  assert.equal(matchesRaw(jsOnly, '<div role=xgroup2>'), true);
  assert.equal(matchesRaw(ere, '<div role=xgroup2>'), false);
});

test('a fixture the selecting dialect cannot match is rejected as stale', () => {
  // The JS-dialect guard passed this pair. measure now runs the same engine the
  // corpus scan does, so it does not.
  assert.throws(
    () =>
      measure('SegmentedPill', 'role=[\\x27"]group[\\x27"]', "<div role='group'>", [], ['a.tsx']),
    /bypass pattern is stale/
  );
});

test('a stale fixture is rejected', () => {
  assert.throws(
    () => measure('SegmentedPill', 'role=[\'"]group[\'"]', '<div role="tab">', [], ['a.tsx']),
    /bypass pattern is stale/
  );
});

test('a raw set that is only the primitive consumers is rejected', () => {
  assert.throws(
    () => measure('tautology', 'role=', '<div role="group">', ['c.tsx'], ['c.tsx']),
    /only matches primitive consumers/
  );
});

test('an empty population is unmeasured, not 0%', () => {
  assert.throws(
    () => measure('zero', 'EmptyState', '<EmptyState />', [], []),
    /adoption is unmeasured/
  );
});

test('measure counts the bypassing files that are not already consumers', () => {
  const result = measure('m', 'X', 'X', ['a.tsx', 'b.tsx'], ['b.tsx', 'c.tsx', 'd.tsx']);
  assert.deepEqual(result, { using: 2, bypassing: 2, total: 4, adoption: 50 });
});

// The anchoring fix. Each string below was found by this file's own patterns in
// apps/frontend and counted as a rendered element.
test('anchored patterns ignore identifiers that merely contain the word', () => {
  const overlays = new RegExp(tagName('Modal', 'Dialog', 'Sheet', 'Popover'));
  for (const identifier of [
    'const [showModal, setShowModal] = useState(false);',
    'import { appointmentCentralModalUtils } from "./utils";',
    'const activePopoverKey = usePopoverKey();',
  ])
    assert.equal(overlays.test(identifier), false, identifier);
  for (const element of ['<Modal open />', '  <AppointmentCentralModal />', '<Dialog>x</Dialog>'])
    assert.equal(overlays.test(element), true, element);
});

test('anchored patterns ignore a generic type argument', () => {
  const overlays = new RegExp(tagName('Modal', 'Dialog', 'Sheet', 'Popover'));
  for (const generic of [
    'const ref = useRef<HTMLDialogElement>(null);',
    'const [view, setView] = useState<ModalView>("list");',
    'type Props = Partial<GroupModalProps>;',
  ])
    assert.equal(overlays.test(generic), false, generic);
});

test('matchingFiles drops primitives, stories, tests and non-.tsx modules', () => {
  const files = matchingFiles(
    stubGit([
      `HEAD:${CORPUS}pages/Appointments.tsx`,
      `HEAD:${CORPUS}ui/primitives/Buttons/Button.tsx`,
      `HEAD:${CORPUS}ui/overlays/Modal.stories.tsx`,
      `HEAD:${CORPUS}__tests__/pages/Appointments.test.tsx`,
      // The numerator leak: barrel re-exports render nothing, import the
      // primitive, and were counted as components that had adopted it.
      `HEAD:${CORPUS}ui/index.ts`,
      `HEAD:${CORPUS}ui/overlays/index.ts`,
      `HEAD:${CORPUS}constants/status.ts`,
    ]),
    ref,
    'anything'
  );
  assert.deepEqual(files, [`HEAD:${CORPUS}pages/Appointments.tsx`]);
});

test('the numerator and the corpus line are the same population on the real repo', () => {
  // corpusSize has always filtered .tsx; matchingFiles did not, so the report
  // annotated a .tsx corpus beside a numerator that was not one. Asserted here
  // against the tree rather than a stub, because the stub above is where the
  // filter is spelled and this is where it has to hold.
  const offenders = [];
  for (const [, marker] of adoption)
    for (const file of matchingFiles(git, ref, `(from|import)[[:space:]][^[:space:]]*${marker}`))
      if (!file.endsWith('.tsx')) offenders.push(`${marker}: ${file}`);
  assert.deepEqual(offenders, []);
  // Control: this loop reaches files at all, so an empty offender list is a
  // verdict rather than an empty scan.
  assert.ok(matchingFiles(git, ref, `(from|import)[[:space:]][^[:space:]]*ui/overlays`).length > 0);
});

test('matchingFiles reports no match as empty, and lets a real git failure through', () => {
  const noMatch = () => {
    const error = new Error('exit 1');
    error.status = 1;
    throw error;
  };
  assert.deepEqual(matchingFiles(noMatch, ref, 'x'), []);
  const broken = () => {
    const error = new Error('fatal: bad revision');
    error.status = 128;
    throw error;
  };
  assert.throws(() => matchingFiles(broken, ref, 'x'), /bad revision/);
});

test('every reported percentage carries its unit and its corpus size', () => {
  const lines = report('abc1234', 762, [
    ['Buttons', { using: 170, bypassing: 188, total: 358, adoption: 47 }],
  ]);
  assert.match(lines[1], /47%/);
  assert.match(lines[1], /unit: files/);
  assert.match(lines[1], /corpus 762 \.tsx/);
});

test('the scorecard runs against the real repository and reports every family', () => {
  const rows = scorecard(git, ref);
  assert.equal(rows.length, adoption.length);
  for (const [name, r] of rows) {
    assert.ok(r.total > 0, `${name}: empty population`);
    assert.equal(r.total, r.using + r.bypassing, `${name}: total is not the population`);
    assert.ok(r.adoption >= 0 && r.adoption <= 100, `${name}: ${r.adoption}% is not a percentage`);
  }
  assert.ok(corpusSize(git, ref) > 0);
});
