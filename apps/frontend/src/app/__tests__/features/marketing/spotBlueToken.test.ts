import { readFileSync } from 'fs';
import { join } from 'path';

// The marketing site's --spot/code-block panels stay dark in both themes.
// Their brand-blue accent (JSON syntax keys, an italic punchline, a "100%"
// callout, a plan badge) used to be a hardcoded #82afec literal, which is
// correct in both themes precisely because --spot never flips - but a
// hardcoded literal is invisible to the design-token system and, unlike the
// established --spot-ink/--spot-success tokens, had no name. This routes
// all 20 occurrences through the new --spot-blue token instead, which is
// declared with the SAME literal value in both theme blocks (a pure
// value-preserving refactor, not a colour change).
const MARKETING_FILES = [
  'src/app/features/marketing/pages/Insights/Insights.tsx',
  'src/app/features/marketing/pages/Home/Home.tsx',
  'src/app/features/marketing/pages/PetBusinesses/PetBusinesses.tsx',
  'src/app/features/marketing/pages/DevelopersPage/DevelopersPage.tsx',
  'src/app/features/marketing/pages/Pricing/Pricing.tsx',
];

describe('marketing site brand-blue accent reads from the fixed --spot-blue token', () => {
  it('no longer hardcodes the brand-blue literal anywhere it was used', () => {
    for (const file of MARKETING_FILES) {
      const source = readFileSync(join(process.cwd(), file), 'utf8');
      expect(source).not.toContain('#82afec');
    }
  });

  it('declares --spot-blue with the same literal in both theme blocks', () => {
    const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');
    const occurrences = css.match(/--spot-blue:\s*#82afec;/g) ?? [];
    expect(occurrences).toHaveLength(2);
  });
});
