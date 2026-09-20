// __tests__/guards/appIntentsRequireUnlock.test.ts
//
// Siri and Shortcuts answer from the App Intents in ios/mobileAppYC. An intent
// that declares no `authenticationPolicy` gets the framework default,
// `.alwaysAllowed`, and a misspelled property compiles cleanly and is silently
// ignored. So neither the Xcode build nor review reliably notices a missing
// policy. This guard does: every intent must ask for an unlocked device.

import {readdirSync, readFileSync, statSync} from 'fs';
import {join, relative} from 'path';

const IOS_APP_ROOT = join(__dirname, '..', '..', 'ios', 'mobileAppYC');

// `struct Name: AppIntent {`, and the refinements such as OpenIntent.
const INTENT_STRUCT =
  /^[ \t]*(?:(?:public|internal|fileprivate|private)[ \t]+)?struct[ \t]+(\w+)[ \t]*:([^{]*)\{/gm;
const INTENT_PROTOCOL = /\b\w*Intent\b/;
const UNLOCK_POLICY =
  /static\s+(?:var|let)\s+authenticationPolicy\s*(?::\s*IntentAuthenticationPolicy\s*)?=\s*\.(?:requiresAuthentication|requiresLocalDeviceAuthentication)\b/;

const collectSwiftFiles = (dir: string): string[] => {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...collectSwiftFiles(fullPath));
    } else if (entry.endsWith('.swift')) {
      files.push(fullPath);
    }
  }
  return files;
};

type IntentDeclaration = {name: string; body: string};

/**
 * Each intent struct with its body. Top-level declarations in these files
 * close with a `}` at column 0, which is where the body ends.
 */
const collectIntents = (source: string): IntentDeclaration[] => {
  const intents: IntentDeclaration[] = [];
  for (const match of source.matchAll(INTENT_STRUCT)) {
    if (!INTENT_PROTOCOL.test(match[2])) {
      continue;
    }
    const start = match.index ?? 0;
    const end = source.indexOf('\n}', start);
    intents.push({
      name: match[1],
      body: source.slice(start, end === -1 ? undefined : end),
    });
  }
  return intents;
};

describe('App Intents require an unlocked device', () => {
  const intents = collectSwiftFiles(IOS_APP_ROOT).flatMap(file =>
    collectIntents(readFileSync(file, 'utf8')).map(intent => ({
      ...intent,
      file: relative(IOS_APP_ROOT, file),
    })),
  );

  it('finds the shipped intents', () => {
    expect(intents.map(intent => intent.name)).toEqual(
      expect.arrayContaining([
        'NextAppointmentIntent',
        'VaccinationStatusIntent',
        'UpcomingTasksIntent',
        'AddCareTaskIntent',
        'BookAppointmentIntent',
        'LogExpenseIntent',
      ]),
    );
  });

  it('declares an unlock policy on every intent', () => {
    const offenders = intents
      .filter(intent => !UNLOCK_POLICY.test(intent.body))
      .map(intent => `${intent.file}: ${intent.name}`);

    expect(offenders).toEqual([]);
  });

  it('flags an intent that leaves the policy at its default', () => {
    // Guards the guard: an empty offender list must mean "all declared", not
    // "the matcher never fires".
    const source = [
      'struct Declared: AppIntent {',
      '  static var authenticationPolicy: IntentAuthenticationPolicy = .requiresAuthentication',
      '}',
      'struct Misspelled: AppIntent {',
      '  static var authenticatonPolicy: IntentAuthenticationPolicy = .requiresAuthentication',
      '}',
      'struct Missing: OpenIntent {',
      '  static var openAppWhenRun: Bool = false',
      '}',
      'struct Query: EntityQuery {',
      '}',
    ].join('\n');

    const found = collectIntents(source);
    expect(found.map(intent => intent.name)).toEqual([
      'Declared',
      'Misspelled',
      'Missing',
    ]);
    expect(
      found
        .filter(intent => !UNLOCK_POLICY.test(intent.body))
        .map(intent => intent.name),
    ).toEqual(['Misspelled', 'Missing']);
  });
});
