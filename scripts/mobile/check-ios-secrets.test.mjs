import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REQUIRED, parseXcconfig, problems } from './check-ios-secrets.mjs';

const complete = REQUIRED.map((k) => `${k} = real-value-for-${k}`).join('\n');

test('accepts an xcconfig where every variable carries a real value', () => {
  assert.deepEqual(problems(parseXcconfig(complete)), []);
});

test('rejects a missing variable and names it', () => {
  const text = complete
    .split('\n')
    .filter((l) => !l.startsWith('FACEBOOK_CLIENT_TOKEN'))
    .join('\n');
  const found = problems(parseXcconfig(text));
  assert.equal(found.length, 1);
  assert.match(found[0], /FACEBOOK_CLIENT_TOKEN is not declared/);
});

// The hole in the first version of this gate: it tested that the key existed,
// which `grep -q` reports for an assignment with nothing after the `=`.
test('rejects a declared but empty value', () => {
  const text = complete.replace(
    'FACEBOOK_APP_ID = real-value-for-FACEBOOK_APP_ID',
    'FACEBOOK_APP_ID ='
  );
  const found = problems(parseXcconfig(text));
  assert.equal(found.length, 1);
  assert.match(found[0], /FACEBOOK_APP_ID is declared but empty/);
});

test('rejects a template placeholder copied verbatim', () => {
  const text = complete.replace(
    'FACEBOOK_APP_ID = real-value-for-FACEBOOK_APP_ID',
    'FACEBOOK_APP_ID = YOUR_FACEBOOK_APP_ID'
  );
  const found = problems(parseXcconfig(text));
  assert.equal(found.length, 1);
  assert.match(found[0], /FACEBOOK_APP_ID still holds a template placeholder/);
});

// The reversed client id placeholder is a compound value, so the check has to look
// inside it rather than compare the whole string.
test('rejects a placeholder embedded in a longer value', () => {
  const text = complete.replace(
    'GOOGLE_REVERSED_CLIENT_ID = real-value-for-GOOGLE_REVERSED_CLIENT_ID',
    'GOOGLE_REVERSED_CLIENT_ID = com.googleusercontent.apps.YOUR_REVERSED_CLIENT_ID'
  );
  const found = problems(parseXcconfig(text));
  assert.equal(found.length, 1);
  assert.match(found[0], /GOOGLE_REVERSED_CLIENT_ID still holds a template placeholder/);
});

// The gate must speak the repo's whole placeholder vocabulary, not one spelling.
for (const bad of ['CHANGE_ME', 'CHANGEME', 'REPLACE_ME', '<API_KEY>']) {
  test(`rejects the ${bad} placeholder spelling`, () => {
    const text = complete.replace(
      'FACEBOOK_APP_ID = real-value-for-FACEBOOK_APP_ID',
      `FACEBOOK_APP_ID = ${bad}`
    );
    const found = problems(parseXcconfig(text));
    assert.equal(found.length, 1);
    assert.match(found[0], /FACEBOOK_APP_ID still holds a template placeholder/);
  });
}

test('reports every unusable variable, not just the first', () => {
  assert.equal(problems(parseXcconfig('')).length, REQUIRED.length);
});

test('ignores comments and tolerates surrounding whitespace', () => {
  const text = [
    '// GOOGLE_MAPS_API_KEY = commented-out-and-must-not-count',
    ...REQUIRED.map((k) => `   ${k}   =   value-${k}   `),
  ].join('\n');
  assert.deepEqual(problems(parseXcconfig(text)), []);
});

test('does not treat a trailing comment as part of the value', () => {
  const values = parseXcconfig('GOOGLE_MAPS_API_KEY = abc123 // from Cloud Console');
  assert.equal(values.get('GOOGLE_MAPS_API_KEY'), 'abc123');
});
