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
 */
const SRC = join(__dirname, '../..');
const EXTENSIONS = ['.ts', '.tsx', '.css'];
// __tests__ is skipped so this file's own worked example above does not match itself.
// Stories live beside their components and are still scanned.
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', '__tests__']);

const collectFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return SKIP_DIRS.has(entry) ? [] : collectFiles(full);
    }
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
      const lines = readFileSync(file, 'utf8').split('\n');
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
