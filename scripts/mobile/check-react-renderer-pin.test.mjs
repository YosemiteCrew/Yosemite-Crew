import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RENDERER, problems, rendererExpectation } from './check-react-renderer-pin.mjs';

// Shaped like the real bundle: minified, the compare sitting immediately before
// the throw, and - the part that matters for the search - a second, unrelated
// version comparison further down. The real file is 366 KB; a search that is not
// scoped to the throw has all of it to go wrong in.
const bundle = (version) =>
  'entangleTransitions(element, parentComponent, lane));return lane;}' +
  `var isomorphicReactPackageVersion = React.version;if ("${version}" !== isomorphicReactPackageVersion)` +
  'throw Error(\'Incompatible React versions: The "react" and "react-native-renderer" ' +
  "packages must have the exact same version.');" +
  'function checkSchema(v){if ("2.0.0" !== v) reportError(v);}';

test('reads the version the renderer was built against', () => {
  assert.equal(rendererExpectation(bundle('19.1.4')), '19.1.4');
});

// Scoping is what makes the answer trustworthy: unscoped, this fixture offers
// two candidates and the function has no way to tell which one guards react.
test('ignores an unrelated version comparison elsewhere in the bundle', () => {
  assert.equal(rendererExpectation(bundle('19.1.4')), '19.1.4');
});

// An ambiguous read is the dangerous outcome, not a missing one: picking either
// candidate would leave the gate reporting green against a literal that guards
// something else. Refusing is what the caller turns into exit 2.
test('refuses to guess when the window holds two candidates', () => {
  const ambiguous = bundle('19.1.4').replace(
    'var isomorphicReactPackageVersion',
    'if ("18.3.1" !== legacyVersion) fallback();var isomorphicReactPackageVersion'
  );
  assert.equal(rendererExpectation(ambiguous), null);
});

test('reads the comparison written the other way round', () => {
  const reversed = bundle('19.1.4').replace(
    '"19.1.4" !== isomorphicReactPackageVersion',
    'isomorphicReactPackageVersion !== "19.1.4"'
  );
  assert.equal(rendererExpectation(reversed), '19.1.4');
});

// A rename upstream must be reported as "cannot run", never as "nothing found,
// so nothing is wrong" - the caller exits 2 on this.
test('returns null when the guard is not where it is expected', () => {
  assert.equal(
    rendererExpectation(bundle('19.1.4').replace('Incompatible React versions', 'Other')),
    null
  );
});

test('accepts an exactly pinned react that matches the renderer', () => {
  assert.deepEqual(problems({ declared: '19.1.4', installed: '19.1.4', expected: '19.1.4' }), []);
});

// The case the hold in .github/dependabot.yml exists for: a PATCH is as fatal as
// a major, because the renderer compares against a literal.
test('rejects a patch bump and names the startup throw', () => {
  const found = problems({ declared: '19.1.5', installed: '19.1.5', expected: '19.1.4' });
  assert.equal(found.length, 1);
  assert.match(found[0], /react 19\.1\.5 is installed/);
  assert.match(found[0], /Incompatible React versions/);
});

test('rejects a range pin even when every version currently agrees', () => {
  const found = problems({ declared: '^19.1.4', installed: '19.1.4', expected: '19.1.4' });
  assert.equal(found.length, 1);
  assert.match(found[0], /which is a range/);
});

test('reports drift between the pin and what is installed', () => {
  const found = problems({ declared: '19.1.4', installed: '19.1.3', expected: '19.1.3' });
  assert.equal(found.length, 1);
  assert.match(found[0], /drifted from the pin/);
});

// A range pin already explains why declared and installed differ, so reporting
// drift as well would send the reader to fix the symptom.
test('does not also report drift when the pin is a range', () => {
  const found = problems({ declared: '^19.1.4', installed: '19.1.9', expected: '19.1.9' });
  assert.equal(found.length, 1);
  assert.match(found[0], /which is a range/);
});

test('reports both the throw and the drift when they are separate faults', () => {
  const found = problems({ declared: '19.1.4', installed: '19.1.5', expected: '19.1.4' });
  assert.equal(found.length, 2);
});

// ReactFabric-prod.js carries no equivalent compare, so a check pointed at it
// could never fail. Pin the path the gate reads.
test('reads the renderer bundle that carries the compare', () => {
  assert.match(RENDERER, /ReactNativeRenderer-prod\.js$/);
});
