import { readFileSync } from 'fs';
import { join } from 'path';

// --blue, --success, --ink-faint and --ink-faint2 are FILL tokens. They owe the
// 3:1 of 1.4.11 and nothing more, and on the bone surfaces they measure
// 1.94-3.73:1 as text. Painting copy with them is what put 73 nodes below AA
// across these four pages; the ramps carry --blue-text, --success-text and
// --ink-muted for exactly this.
//
// The rule has no exceptions: the always-dark --spot panels use --spot-ink-faint
// and --spot-blue, which are fixed in both themes, and the icon-only chips are
// routed through the text members too rather than earning a per-file budget
// nobody would keep accurate.
//
// The e2e axe suite is the real gate (e2e/a11y.spec.ts, "Mockup-heavy public
// pages"). This is its cheap twin: it fails in the second it takes to read a
// file rather than the two minutes it takes to scroll and scan eight pages.
const FILES = [
  'src/app/features/marketing/pages/Insights/Insights.tsx',
  'src/app/features/marketing/pages/PetBusinesses/PetBusinesses.tsx',
  'src/app/features/marketing/pages/PetParents/PetParents.tsx',
  'src/app/features/legal/pages/DmcaCopyrightPolicy.tsx',
];

// color: 'var(--blue)' and color="var(--success)", but not background/border,
// and not --blue-text/--blue-soft/--blue-strong.
const paintsTextWith = (token: string) =>
  new RegExp(`\\bcolor(?:=|:\\s*)["']?\\s*var\\(${token}\\)`, 'g');

const FILL_TOKENS = ['--blue', '--success', '--ink-faint', '--ink-faint2'];

describe('marketing mockups never paint text with a fill token', () => {
  it.each(FILES)('%s', (file) => {
    const source = readFileSync(join(process.cwd(), file), 'utf8');
    for (const token of FILL_TOKENS) {
      const hits = source.match(paintsTextWith(token)) ?? [];
      expect({ token, hits }).toEqual({ token, hits: [] });
    }
  });

  it('the readable text members it should use instead are all declared', () => {
    const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');
    for (const token of ['--blue-text', '--success-text', '--ink-muted', '--spot-ink-faint']) {
      expect(css).toContain(`${token}:`);
    }
  });
});
