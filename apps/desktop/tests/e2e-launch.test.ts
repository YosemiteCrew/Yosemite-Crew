'use strict';

import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {
  APP_ROOT,
  ELECTRON_EXECUTABLE,
  MOCK_KEYCHAIN_SWITCH,
  electronLaunchOptions,
} from './e2e/launch';

const E2E_DIR = path.join(__dirname, 'e2e');

const specSources = (): Array<{ name: string; source: string }> =>
  fs
    .readdirSync(E2E_DIR)
    .filter((name) => name.endsWith('.e2e.ts'))
    .map((name) => ({ name, source: fs.readFileSync(path.join(E2E_DIR, name), 'utf8') }));

// Every `electron.launch(...)` call in a spec, as syntax rather than as text.
//
// Both halves of this matter. PER CALL, not per file: a file-wide
// `source.includes(...)` clears a whole spec as soon as ONE call spreads the
// helper, so in a file with two launches the second can quietly assemble its
// own argv - and window-controls.e2e.ts has two.
//
// And via the AST, not by scanning for balanced parentheses: a `')'` inside a
// string literal, a template or a comment ends a hand-rolled scan early, and
// the checks below then run on a truncated slice and see nothing wrong. Only
// the parser knows which parenthesis is code.
const launchCalls = (name: string, source: string): ts.CallExpression[] => {
  const file = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const calls: ts.CallExpression[] = [];

  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'launch' &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'electron'
    ) {
      calls.push(node);
    }
    ts.forEachChild(node, visit);
  };

  ts.forEachChild(file, visit);
  return calls;
};

const spreadsHelper = (property: ts.ObjectLiteralElementLike): boolean =>
  ts.isSpreadAssignment(property) &&
  ts.isCallExpression(property.expression) &&
  ts.isIdentifier(property.expression.expression) &&
  property.expression.expression.text === 'electronLaunchOptions';

// The fields the helper exists to supply, and which nothing later may replace.
const HELPER_SUPPLIED = ['executablePath', 'args'];

// A call is compliant when its options object spreads the helper and every
// other entry is a plainly named property that is not one of those fields.
//
// A whitelist, deliberately. Blacklisting the two names only catches the
// author who spells them: `...{ args: [...] }`, `...someOptions` and
// `['args']: [...]` all replace the argv at runtime without the string `args`
// ever appearing as a property name. The set of ways to do that is open, so
// the guard rejects everything it cannot read instead of enumerating them. The
// price is that a future spec wanting to spread anything else here has to
// inline it - which is the trade this invariant is for. Nested spreads are
// untouched: `env: { ...process.env }` is a property, not an entry.
const isCompliant = (call: ts.CallExpression): boolean => {
  const [options] = call.arguments;
  if (options === undefined || !ts.isObjectLiteralExpression(options)) return false;

  const helperSpreads = options.properties.filter(spreadsHelper);
  if (helperSpreads.length !== 1) return false;

  return options.properties.every((property) => {
    if (property === helperSpreads[0]) return true;
    if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) {
      return false;
    }
    // A computed key is unreadable here, so it is rejected whatever it holds.
    if (!ts.isIdentifier(property.name) && !ts.isStringLiteral(property.name)) return false;

    return !HELPER_SUPPLIED.includes(property.name.text);
  });
};

const offendingCalls = (name: string, source: string): string[] =>
  launchCalls(name, source)
    .map((call, index) => ({ label: `${name} call ${index + 1}`, call }))
    .filter(({ call }) => !isCompliant(call))
    .map(({ label }) => label);

describe('e2e Electron launch options', () => {
  it('launches the app root with the mock keystore switch', () => {
    const { executablePath, args } = electronLaunchOptions();

    expect(executablePath).toBe(ELECTRON_EXECUTABLE);
    // Spelled out rather than compared against the exported constant: a
    // fixture built from the constant cannot pin the constant, and Chromium
    // ignores an unknown switch silently.
    expect(args).toEqual([APP_ROOT, '--use-mock-keychain']);
    expect(MOCK_KEYCHAIN_SWITCH).toBe('--use-mock-keychain');
  });

  it('keeps node flags ahead of the app root', () => {
    const recorder = path.join('/tmp', 'record-shortcuts.js');

    expect(electronLaunchOptions({ nodeArgs: ['-r', recorder] }).args).toEqual([
      '-r',
      recorder,
      APP_ROOT,
      '--use-mock-keychain',
    ]);
  });

  // Fixtures rather than the tree: whether the suite currently HAS a two-launch
  // file is an accident of the specs, so a per-call checker that silently
  // regressed to per-file would still pass against today's tree. These fail.
  describe.each([
    [
      'supplies its own argv',
      'await electron.launch({ executablePath: electronPath, args: [APP_ROOT] });',
    ],
    // The cheaper regression: someone drops the spread while rebasing.
    ['supplies nothing', 'await electron.launch({ env: { ...process.env } });'],
    [
      'spreads the helper and then overrides args',
      'await electron.launch({ ...electronLaunchOptions(), args: [APP_ROOT] });',
    ],
    [
      'spreads the helper and then overrides executablePath',
      'await electron.launch({ ...electronLaunchOptions(), executablePath: other });',
    ],
    // A `)` inside a string is not a closing parenthesis. A scanner that
    // counted characters ended the call here and passed the mutant.
    [
      'hides a close parenthesis in a string before overriding args',
      "await electron.launch({ ...electronLaunchOptions(), env: { M: ')' }, args: [APP_ROOT] });",
    ],
    [
      'hides a close parenthesis in a template before overriding args',
      'await electron.launch({ ...electronLaunchOptions(), env: { M: `${x})` }, args: [APP_ROOT] });',
    ],
    [
      'hides a close parenthesis in a comment before overriding args',
      'await electron.launch({ ...electronLaunchOptions(), /* ) */ args: [APP_ROOT] });',
    ],
    // Not an object literal at all, so nothing can be asserted about it.
    ['passes a prebuilt options object', 'await electron.launch(options);'],
    // The next four never spell `args` or `executablePath` as a property name,
    // and all four replace the argv at runtime. This is why the check is a
    // whitelist of what may follow the spread rather than a list of bad keys.
    [
      'spreads an inline object over the helper',
      "await electron.launch({ ...electronLaunchOptions(), ...{ args: ['mutant-app-root'] } });",
    ],
    [
      'spreads an unresolved identifier over the helper',
      'await electron.launch({ ...electronLaunchOptions(), ...overrides });',
    ],
    [
      'overrides args through a computed key',
      "await electron.launch({ ...electronLaunchOptions(), ['args']: ['mutant-app-root'] });",
    ],
    [
      'overrides executablePath through a computed key',
      "await electron.launch({ ...electronLaunchOptions(), ['executablePath']: other });",
    ],
    [
      'overrides args through a string-literal key',
      "await electron.launch({ ...electronLaunchOptions(), 'args': ['mutant-app-root'] });",
    ],
    // Readable, but the guard cannot know what the key evaluates to.
    [
      'uses a computed key it cannot read',
      'await electron.launch({ ...electronLaunchOptions(), [key]: value });',
    ],
  ])('alongside a compliant call, a call that %s is named', (_label, bypass) => {
    const compliant = 'await electron.launch({ ...electronLaunchOptions(), env: process.env });';

    it('is reported when it comes second', () => {
      expect(offendingCalls('two.e2e.ts', `${compliant}\n${bypass}`)).toEqual([
        'two.e2e.ts call 2',
      ]);
    });

    it('is reported when it comes first', () => {
      expect(offendingCalls('two.e2e.ts', `${bypass}\n${compliant}`)).toEqual([
        'two.e2e.ts call 1',
      ]);
    });
  });

  // The mirror of the cases above: the guard must not manufacture offenders
  // out of the punctuation the real specs contain, or it gets switched off.
  it.each([
    [
      'nested calls in env',
      "await electron.launch({ ...electronLaunchOptions(), env: { D: mkdtempSync(join(tmpdir(), 'x')) } });",
    ],
    [
      'the helper\u2019s own nodeArgs input',
      "await electron.launch({ ...electronLaunchOptions({ nodeArgs: ['-r', r] }), env: e });",
    ],
    [
      'a close parenthesis in a string',
      "await electron.launch({ ...electronLaunchOptions(), env: { U: 'a)b' } });",
    ],
    // Every real spec does this. A whitelist over the OUTER entries only.
    [
      'a spread nested inside env',
      'await electron.launch({ ...electronLaunchOptions(), env: { ...process.env, A: b } });',
    ],
    ['a shorthand property', 'await electron.launch({ ...electronLaunchOptions(), env });'],
  ])('accepts a compliant call with %s', (_label, source) => {
    expect(launchCalls('ok.e2e.ts', source)).toHaveLength(1);
    expect(offendingCalls('ok.e2e.ts', source)).toEqual([]);
  });

  // The switch only holds if EVERY call gets it. One call that assembles its
  // own argv is one spec that hangs forever at electron.launch on a machine
  // whose "<product> Safe Storage" keychain item was written by a different
  // build - with a bare timeout and an empty trace. See issue #3422.
  it('is how every spec in the suite launches Electron', () => {
    const specs = specSources();
    const callCount = specs.reduce(
      (total, { name, source }) => total + launchCalls(name, source).length,
      0
    );

    // A filter over an empty list reports no offenders, so the check would
    // pass on a suite this guard could not see. Pin that it saw calls at all,
    // and that it saw the file that has more than one.
    expect(callCount).toBeGreaterThan(0);
    expect(
      launchCalls(
        'window-controls.e2e.ts',
        fs.readFileSync(path.join(E2E_DIR, 'window-controls.e2e.ts'), 'utf8')
      ).length
    ).toBeGreaterThan(1);

    const offenders = specs.flatMap(({ name, source }) => offendingCalls(name, source));

    expect(offenders).toEqual([]);
  });
});
