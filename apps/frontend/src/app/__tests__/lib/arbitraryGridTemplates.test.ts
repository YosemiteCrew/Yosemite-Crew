import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Tailwind arbitrary grid templates separate tracks with an underscore, because a
 * space cannot appear inside a class name. A comma is not a track separator in CSS
 * grid at all, so `grid-cols-[auto,minmax(0,1fr)]` compiles to
 * `grid-template-columns: auto,minmax(0,1fr)`, which the browser rejects outright
 * and drops. The element then falls back to a single implicit column and every
 * child stacks vertically.
 *
 * Nothing catches this: it is a valid class name, so Tailwind emits it, and tsc,
 * eslint and jsdom all see a perfectly ordinary string. It only shows up in a real
 * browser, and only on whatever surface renders it - the one occurrence found was
 * inside a task popover that exists solely after a click, which is why no story or
 * screenshot had ever drawn it.
 *
 * Commas *inside* a function - minmax(0,1fr), repeat(2,1fr) - are correct and must
 * not trip this, so parentheses are stripped before the check.
 *
 * Two exclusions, both learned the hard way when this test failed on its own subject
 * matter:
 *
 * - Comments are stripped first. The fix commit put the broken form in a comment above
 *   the component to explain what had gone wrong, and the guard flagged the explanation.
 * - `.stories.tsx` is skipped. A story's docs prose legitimately quotes the broken class
 *   when describing the bug, and a guard that punishes documenting itself gets deleted
 *   rather than fixed. Story files are not shipped UI; the cost is that a broken template
 *   inside a story harness would go unflagged, which is worth it to keep the rule honest
 *   about shipped source.
 */
const SRC = join(__dirname, '../..');
const EXTENSIONS = ['.ts', '.tsx', '.css'];
// __tests__ is skipped so this file's own worked example above does not match itself.
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', '__tests__']);

/** Block and line comments, so an explanation of the bug is not read as the bug. */
const stripComments = (source: string): string =>
  source.replaceAll(/\/\*[\s\S]*?\*\//g, ' ').replaceAll(/(^|[^:])\/\/[^\n]*/g, '$1 ');

const collectFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return SKIP_DIRS.has(entry) ? [] : collectFiles(full);
    }
    if (entry.endsWith('.stories.tsx')) return [];
    return EXTENSIONS.some((ext) => entry.endsWith(ext)) ? [full] : [];
  });

const stripBalancedParens = (value: string): string => {
  let current = value;
  let previous = '';
  while (previous !== current) {
    previous = current;
    current = current.replaceAll(/\([^()]*\)/g, '');
  }
  return current;
};

describe('arbitrary grid templates', () => {
  it('separates tracks with an underscore, never a comma', () => {
    const pattern = /grid-(?:cols|rows)-\[([^\]]*)\]/g;
    const offenders: string[] = [];

    for (const file of collectFiles(SRC)) {
      const lines = stripComments(readFileSync(file, 'utf8')).split('\n');
      lines.forEach((line, index) => {
        for (const match of line.matchAll(pattern)) {
          if (stripBalancedParens(match[1]).includes(',')) {
            offenders.push(`${file.replace(SRC, '')}:${index + 1} ${match[0]}`);
          }
        }
      });
    }

    expect(offenders).toEqual([]);
  });
});
