import fs from 'node:fs';
import path from 'node:path';

const workflow = fs.readFileSync(
  path.join(__dirname, '../../../.github/workflows/override-advisories.yml'),
  'utf8'
);

describe('nightly dependency checks', () => {
  test.each(['main', 'dev'])('%s checks its own branch', (branch) => {
    expect(workflow).toContain('branch: [main, dev]');
    const checkouts = workflow
      .split(/^ {6}- name:/m)
      .filter((step) => step.includes('uses: actions/checkout@'));
    expect(checkouts).toHaveLength(2);
    const checkout = checkouts.find((step) => step.includes(`if: matrix.branch == '${branch}'`));
    expect(checkout).toBeDefined();
    expect(checkout).toMatch(new RegExp(`^          ref: ${branch}$`, 'm'));
    expect(checkout).toContain('persist-credentials: false');
    expect(workflow).toContain('uses: ./.github/actions/setup');
    expect(workflow).toContain('node scripts/ci/check-override-advisories.mjs --strict');
    expect(workflow).toContain('contents: read');
    expect(workflow).toContain('fail-fast: false');
  });
});
