#!/usr/bin/env node
// Info.plist is tracked and resolves several values through $(...) build variables.
// xcodebuild does not fail when one is absent: it substitutes an empty string, or
// embeds the literal placeholder, and the archive succeeds. The app then ships with
// Google Maps blank and Facebook and Google sign-in dying at the redirect, with
// nothing in the build log pointing at the cause. This is the check that turns that
// into a build failure that names the key.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const root = join(dirname(process.argv[1]), '../../apps/mobileAppYC');
const XCCONFIG = 'ios/mobileAppYC/Secrets.xcconfig';

// Every variable Info.plist dereferences. Keep in step with the $(...) references
// there; a name here that the plist does not use is a false failure, and one it
// uses but this omits is the silent breakage above.
/**
 * The repository's placeholder vocabulary, shared with doctor.mjs. One regex,
 * because a gate that recognises only one spelling waves through the others:
 * CHANGE_ME, REPLACE_ME and <API_KEY> are all shapes the templates in this
 * repo have used.
 */
export const PLACEHOLDER = /YOUR_[A-Z_]+|CHANGE_?ME|REPLACE_?ME|<[A-Z_]+>/;

export const REQUIRED = [
  'GOOGLE_MAPS_API_KEY',
  'FACEBOOK_APP_ID',
  'FACEBOOK_CLIENT_TOKEN',
  'GOOGLE_REVERSED_CLIENT_ID',
];

/**
 * Read `KEY = value` assignments. xcconfig comments run to end of line, and a
 * trailing comment is not part of the value.
 */
export const parseXcconfig = (text) => {
  const out = new Map();
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\/\/.*$/, '');
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (m) out.set(m[1], m[2].trim());
  }
  return out;
};

/**
 * Why each required variable is unusable, if it is. Presence of the key is not
 * enough: `FACEBOOK_APP_ID =` parses fine and substitutes to nothing, and a
 * template value copied verbatim substitutes to a literal that reaches the store.
 */
export const problems = (values) => {
  const found = [];
  for (const key of REQUIRED) {
    if (!values.has(key)) {
      found.push(`${key} is not declared`);
    } else if (values.get(key) === '') {
      found.push(`${key} is declared but empty`);
    } else if (PLACEHOLDER.test(values.get(key))) {
      found.push(`${key} still holds a template placeholder`);
    }
  }
  return found;
};

// Exit early when imported by the tests rather than run.
if (process.argv[1] && resolve(process.argv[1]).endsWith('check-ios-secrets.mjs')) {
  const path = join(root, XCCONFIG);
  if (!existsSync(path)) {
    console.error(`::error::${XCCONFIG} is missing. IOS_SECRETS_XCCONFIG did not restore.`);
    process.exit(1);
  }
  const found = problems(parseXcconfig(readFileSync(path, 'utf8')));
  if (found.length > 0) {
    console.error(
      `::error::IOS_SECRETS_XCCONFIG cannot build a working app: ${found.join('; ')}. ` +
        'Info.plist reads these as build variables, so the archive would succeed and ' +
        'Maps and sign-in would fail at runtime.'
    );
    process.exit(1);
  }
  console.log(`All ${REQUIRED.length} iOS build variables carry real values.`);
}
