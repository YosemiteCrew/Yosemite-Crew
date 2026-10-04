import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const loadModule = createRequire(__filename);

const bundle = path.join(
  path.dirname(require.resolve('aws-cdk-lib/package.json')),
  'node_modules/brace-expansion'
);
type Options = { maxDepth?: number; maxRewrites?: number };

function expand(mode: string, input: string, options: Options = {}): string[] {
  if (mode === 'commonjs') {
    return loadModule(path.join(bundle, 'dist/commonjs/index.js')).expand(input, options);
  }
  const moduleUrl = pathToFileURL(path.join(bundle, 'dist/esm/index.js')).href;
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import { expand } from ${JSON.stringify(moduleUrl)}; console.log(JSON.stringify(expand(${JSON.stringify(input)}, ${JSON.stringify(options)})));`,
    ],
    { encoding: 'utf8', timeout: 5000 }
  );
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(0);
  return JSON.parse(result.stdout);
}

describe.each(['commonjs', 'esm'])('%s bundled expansion', (mode) => {
  test('retains ordinary alternatives', () => {
    expect(expand(mode, 'file-{a,b}-{1..2}')).toEqual([
      'file-a-1',
      'file-a-2',
      'file-b-1',
      'file-b-2',
    ]);
  });

  test('honors the requested nesting depth', () => {
    expect(expand(mode, 'x{a,{b,c}}y', { maxDepth: 0 })).toEqual(['xay', 'x{b,c}y']);
  });

  test('honors the requested rewrite count', () => {
    expect(expand(mode, '{a},b}', { maxRewrites: 0 })).toEqual(['{a},b}']);
  });

  test('keeps long comma members intact', () => {
    const member = '{b}'.repeat(6000);
    expect(expand(mode, `{a,${member}}`)).toEqual(['a', member]);
  });
});
