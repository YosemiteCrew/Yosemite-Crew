import { readFileSync } from 'fs';
import { join } from 'path';

// These marketing pages hardcoded copies of colours that already exist as
// fixed (non-flipping) entries in the --color-success-*/--color-brand-*
// ramps in globals.css (declared once, outside any theme block), instead
// of reading the ramp. This routes each occurrence through its matching
// token - a pure value-preserving refactor, not a colour change.
const CASES = [
  {
    literal: '#8acbb4',
    token: 'var(--color-success-300)',
    files: [
      'src/app/features/marketing/pages/Home/Home.tsx',
      'src/app/features/marketing/pages/DevelopersPage/DevelopersPage.tsx',
    ],
  },
  {
    literal: '#54b492',
    token: 'var(--color-success-400)',
    files: [
      'src/app/features/marketing/pages/Pricing/Pricing.tsx',
      'src/app/features/marketing/pages/DevelopersPage/DevelopersPage.tsx',
    ],
  },
  {
    literal: '#33a57d',
    token: 'var(--color-success-500)',
    files: ['src/app/features/marketing/pages/Home/Home.tsx'],
  },
  {
    literal: '#99bdec',
    token: 'var(--color-brand-600)',
    files: ['src/app/features/marketing/pages/Home/Home.tsx'],
  },
  {
    literal: '#6aa1eb',
    token: 'var(--color-brand-800)',
    files: ['src/app/features/marketing/pages/Home/Home.tsx'],
  },
  {
    literal: '#3b87ec',
    token: 'var(--color-brand-925)',
    files: ['src/app/features/marketing/pages/Home/Home.tsx'],
  },
];

describe('marketing pages read success/brand ramp colours from the fixed tokens', () => {
  for (const { literal, token, files } of CASES) {
    describe(literal, () => {
      for (const file of files) {
        const source = readFileSync(join(process.cwd(), file), 'utf8');

        it(`does not hardcode ${literal} as a frozen literal in ${file}`, () => {
          expect(source).not.toContain(`'${literal}'`);
        });

        it(`routes through ${token} in ${file}`, () => {
          expect(source).toContain(`'${token}'`);
        });
      }
    });
  }

  it('declares each ramp entry once, outside any theme block, in globals.css', () => {
    const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');
    expect(css.match(/--color-success-300:\s*#8acbb4;/g) ?? []).toHaveLength(1);
    expect(css.match(/--color-success-400:\s*#54b492;/g) ?? []).toHaveLength(1);
    expect(css.match(/--color-success-500:\s*#33a57d;/g) ?? []).toHaveLength(1);
    expect(css.match(/--color-brand-600:\s*#99bdec;/g) ?? []).toHaveLength(1);
    expect(css.match(/--color-brand-800:\s*#6aa1eb;/g) ?? []).toHaveLength(1);
    expect(css.match(/--color-brand-925:\s*#3b87ec;/g) ?? []).toHaveLength(1);
  });
});
