import path from 'node:path';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

type PatternNode = {
  type: string;
  value?: string;
  nodes?: PatternNode[];
  parent?: PatternNode;
};
type Options = { maxDepth?: number; escapeInvalid?: boolean };
type Braces = {
  parse: (input: string, options?: Options) => PatternNode;
  compile: (input: string | PatternNode, options?: Options) => string;
  expand: (input: string | PatternNode, options?: Options) => string[];
  stringify: (input: PatternNode, options?: Options) => string;
};
let loadModule = createRequire(path.join(__dirname, '../../backend/package.json'));
for (const name of ['nodemon', 'chokidar']) {
  loadModule = createRequire(loadModule.resolve(`${name}/package.json`));
}
const braces: Braces = loadModule('braces');

function nestedTree(depth: number): PatternNode {
  let node: PatternNode = { type: 'text', value: 'a' };
  for (let index = 0; index < depth; index++) {
    node = { type: 'brace', nodes: [node] };
  }
  return { type: 'root', nodes: [node] };
}

describe('dependency pattern processing', () => {
  test.each(['parse', 'compile', 'expand'] as const)('bounds nested input in %s', (method) => {
    const pattern = '{'.repeat(3500) + 'a,b' + '}'.repeat(3500);
    expect(() => braces[method](pattern)).toThrow('exceeds max depth');
  });

  test('bounds nested parentheses', () => {
    expect(() => braces.parse('('.repeat(101) + 'a' + ')'.repeat(101))).toThrow(
      'exceeds max depth'
    );
  });

  test.each(['compile', 'expand', 'stringify'] as const)(
    'bounds a supplied tree in %s',
    (method) => {
      expect(() => braces[method](nestedTree(101))).toThrow('exceeds max depth');
    }
  );

  test.each([1, 2])('rejects a parent cycle of %i nodes', (count) => {
    const tree: PatternNode = { type: 'paren', nodes: [{ type: 'text', value: 'a' }] };
    if (count === 1) {
      tree.parent = tree;
    } else {
      const parent: PatternNode = { type: 'paren', parent: tree };
      tree.parent = parent;
    }
    expect(() =>
      runInNewContext('expand(tree)', { expand: braces.expand, tree }, { timeout: 250 })
    ).toThrow('parent chain contains a cycle');
  });

  test.each([1, 1.5])('honors a lower nesting depth of %s', (maxDepth) => {
    expect(() => braces.parse('{{a,b},c}', { maxDepth })).toThrow('exceeds max depth');
  });

  test('retains the default bound for an unbounded option', () => {
    expect(() =>
      braces.parse('{'.repeat(101) + 'a,b' + '}'.repeat(101), { maxDepth: Infinity })
    ).toThrow('exceeds max depth');
  });

  test('retains ordinary compiled alternatives and ranges', () => {
    expect(braces.compile('a{1..3}b{c,d}')).toBe('a([1-3])b(c|d)');
  });

  test('retains ordinary expanded alternatives and ranges', () => {
    expect(braces.expand('a{1..3}b{c,d}')).toEqual([
      'a1bc',
      'a1bd',
      'a2bc',
      'a2bd',
      'a3bc',
      'a3bd',
    ]);
  });

  test('retains valid nested text when escaping invalid patterns', () => {
    const pattern = '{a,{b,{c}}}';
    expect(braces.stringify(braces.parse(pattern), { escapeInvalid: true })).toBe(pattern);
  });

  test('accepts a pattern at its requested depth', () => {
    expect(braces.stringify(braces.parse('{{a,b},c}', { maxDepth: 2 }))).toBe('{{a,b},c}');
  });

  test('expands ordinary parenthesized alternatives', () => {
    expect(braces.expand(braces.parse('foo/({a,b})'))).toEqual(['foo/(a)', 'foo/(b)']);
  });
});
