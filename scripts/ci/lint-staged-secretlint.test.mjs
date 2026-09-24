// The secretlint task in lint-staged.config.cjs, run the way lint-staged runs it:
// the task builds a command string, lint-staged splits it with string-argv and
// spawns it without a shell. A secretlint upgrade changed how it reads its
// arguments once already (11.x globbed them, 13.x does not), and the config's
// escaping then hid every Next.js dynamic-route file from the pre-commit scan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const config = require(join(ROOT, 'lint-staged.config.cjs'));
const { parseArgsStringToArgv } = createRequire(require.resolve('lint-staged/package.json'))(
  'string-argv'
);

// Every command the config would run for these files that invokes secretlint.
const secretlintCommands = (files) =>
  Object.values(config)
    .flatMap((task) => task(files))
    .filter((command) => command.startsWith('secretlint '));

const run = (command) => {
  const [bin, ...args] = parseArgsStringToArgv(command);
  const exe = join(ROOT, 'node_modules', '.bin', bin);
  return spawnSync(exe, args, { cwd: ROOT, encoding: 'utf8' });
};

// A GitHub token SHAPE, assembled at run time so no credential-shaped literal is
// ever committed. It is random, so it is not a working token either.
const fakeToken = () => {
  const alnum = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return (
    ['gh', 'p_'].join('') + Array.from(randomBytes(36), (b) => alnum[b % alnum.length]).join('')
  );
};

const withRouteFiles = (fn) => {
  const dir = mkdtempSync(join(tmpdir(), 'yc-lint-staged-'));
  try {
    const route = join(dir, '(routes)', '(share)', 'passport', '[id]');
    mkdirSync(route, { recursive: true });
    const plain = join(dir, 'plain.ts');
    writeFileSync(plain, 'export const answer = 42;\n');
    fn({ route, plain });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

test('a secret in a dynamic-route file is reported when it is staged with another file', () => {
  withRouteFiles(({ route, plain }) => {
    const leak = join(route, 'Leak.tsx');
    writeFileSync(leak, `export const token = '${fakeToken()}';\n`);
    const commands = secretlintCommands([leak, plain]);
    assert.equal(commands.length, 1);

    const result = run(commands[0]);
    assert.equal(
      result.status,
      1,
      `expected a finding, got exit ${result.status}: ${result.stderr}`
    );
    assert.match(result.stdout + result.stderr, /Leak\.tsx/);
  });
});

test('a clean dynamic-route file staged alone passes instead of failing the hook', () => {
  withRouteFiles(({ route }) => {
    const clean = join(route, 'Page.tsx');
    writeFileSync(clean, 'export default function Page() { return null; }\n');

    const result = run(secretlintCommands([clean])[0]);
    assert.equal(
      result.status,
      0,
      `expected a clean pass, got exit ${result.status}: ${result.stderr}`
    );
  });
});
