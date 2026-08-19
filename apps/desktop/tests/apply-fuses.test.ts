import fs from 'node:fs';
import path from 'node:path';

/**
 * `apply-fuses.js` sets `strictlyRequireAllFuses: true`, so @electron/fuses
 * refuses to build when a fuse is left unconfigured. That is the right default,
 * but the failure only surfaced at release time: the 2.1 bump added
 * `WasmTrapHandlers`, and the v0.1.0-beta.4 tag failed on both runners after the
 * signed-build jobs had already been approved and started.
 *
 * This turns it into a PR-time failure. The fuse list is read from the INSTALLED
 * package rather than hardcoded, so a bump that adds another fuse fails here.
 * It is read as text because @electron/fuses is ESM-only and this suite is CJS.
 */
describe('apply-fuses', () => {
  const desktopRoot = path.join(__dirname, '..');
  const source = fs.readFileSync(path.join(desktopRoot, 'scripts', 'apply-fuses.js'), 'utf8');
  const fuseTypes = fs.readFileSync(
    path.join(desktopRoot, 'node_modules', '@electron', 'fuses', 'dist', 'config.d.ts'),
    'utf8'
  );

  const declaredFuses = (): string[] => {
    const block = /export declare enum FuseV1Options \{([^}]*)\}/.exec(fuseTypes);
    if (!block) throw new Error('FuseV1Options enum not found in @electron/fuses types');
    return [...block[1].matchAll(/^\s*([A-Za-z0-9]+)\s*=/gm)].map((m) => m[1]);
  };

  it('reads a non-empty fuse list from the installed package', () => {
    // Guards the regex above: if it ever matches nothing, the completeness
    // assertion below would pass vacuously.
    expect(declaredFuses().length).toBeGreaterThanOrEqual(8);
  });

  it('configures every fuse the installed @electron/fuses knows about', () => {
    const missing = declaredFuses().filter((name) => !source.includes(`FuseV1Options.${name}`));
    expect(missing).toEqual([]);
  });

  it('still requires all fuses explicitly', () => {
    // If this is relaxed the check above stops meaning anything: an
    // unconfigured fuse would take its default silently instead of failing.
    expect(source).toContain('strictlyRequireAllFuses: true');
  });
});
