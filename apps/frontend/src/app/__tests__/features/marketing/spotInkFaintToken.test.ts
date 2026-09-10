import { readFileSync } from 'fs';
import { join } from 'path';

// The marketing site's --spot cards stay dark in both themes. Their muted
// body copy (below a --spot-ink headline or a --spot-blue eyebrow) used to
// be a hardcoded #a9a39e literal, which happens to be correct in both
// themes precisely because --spot never flips - but a hardcoded literal is
// invisible to the design-token system and, unlike the established
// --spot-ink/--spot-success/--spot-blue tokens, had no name. This routes
// all 8 occurrences through the new --spot-ink-faint token instead, which
// is declared with the SAME literal value in both theme blocks (a pure
// value-preserving refactor, not a colour change).
const MARKETING_FILES = [
  'src/app/features/marketing/pages/DevelopersPage/DevelopersPage.tsx',
  'src/app/features/marketing/pages/About/About.tsx',
  'src/app/features/marketing/pages/Pricing/Pricing.tsx',
];

describe('marketing site muted spot-card copy reads from the fixed --spot-ink-faint token', () => {
  it('no longer hardcodes the muted-ink literal anywhere it was used', () => {
    for (const file of MARKETING_FILES) {
      const source = readFileSync(join(process.cwd(), file), 'utf8');
      expect(source).not.toContain('#a9a39e');
    }
  });

  it('declares --spot-ink-faint with the same literal in both theme blocks', () => {
    const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');
    const occurrences = css.match(/--spot-ink-faint:\s*#a9a39e;/g) ?? [];
    expect(occurrences).toHaveLength(2);
  });
});
