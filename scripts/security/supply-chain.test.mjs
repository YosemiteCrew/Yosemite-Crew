// Targeted tests for the supply-chain gate runner (scripts/security/
// supply-chain.sh). The runner decides merge and release gate conclusions, so
// its routing and guard behaviour are pinned here; the network-touching paths
// (tool download, scanning) are exercised by the workflow itself on every PR.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = join(dirname(fileURLToPath(import.meta.url)), 'supply-chain.sh');

const run = (args, env = {}) => {
  try {
    const stdout = execFileSync('bash', [script, ...args], {
      env: { ...process.env, ...env },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 0, output: stdout };
  } catch (err) {
    return {
      status: err.status,
      output: `${err.stdout ?? ''}${err.stderr ?? ''}`,
    };
  }
};

// A fake repo root with tools already "installed" so ensure_tool never hits
// the network: stub syft/grype/grant answer the version probe with the pinned
// versions the script expects.
const fakeRoot = (versions = { syft: '1.50.0', grype: '0.116.1', grant: '0.6.8' }) => {
  const root = mkdtempSync(join(tmpdir(), 'supply-chain-test-'));
  const bin = join(root, '.security-tools', 'bin');
  mkdirSync(bin, { recursive: true });
  for (const [name, version] of Object.entries(versions)) {
    writeFileSync(join(bin, name), `#!/usr/bin/env bash\necho "Version: ${version}"\n`, {
      mode: 0o755,
    });
  }
  return root;
};

test('unknown subcommand exits 2 with usage', () => {
  const { status, output } = run(['bogus'], {
    SUPPLY_CHAIN_REPO_ROOT: fakeRoot(),
  });
  assert.equal(status, 2);
  assert.match(output, /usage: .*\{sbom\|scan\|licenses\|all\}/);
});

test('sbom without node_modules exits 2 and says to install first', () => {
  const { status, output } = run(['sbom'], {
    SUPPLY_CHAIN_REPO_ROOT: fakeRoot(),
  });
  assert.equal(status, 2);
  assert.match(output, /node_modules missing - run pnpm install first/);
});

test("scan fails when an exception's re-review date has expired", () => {
  const root = fakeRoot();
  // A current SBOM (newer than the lockfile refs) so staleness passes and the
  // expiry guard is what trips.
  writeFileSync(join(root, 'pnpm-lock.yaml'), "lockfileVersion: '6.0'\n");
  writeFileSync(join(root, 'package.json'), '{}\n');
  const sbomDir = join(root, 'security', 'sbom');
  mkdirSync(sbomDir, { recursive: true });
  writeFileSync(join(sbomDir, 'yosemite-crew.cdx.json'), '{}');
  const past = new Date(Date.now() - 60_000);
  utimesSync(join(root, 'pnpm-lock.yaml'), past, past);
  utimesSync(join(root, 'package.json'), past, past);
  writeFileSync(join(root, '.grype.yaml'), '# Re-review by: 2020-01-01\nignore: []\n');
  writeFileSync(join(root, '.grant.yaml'), 'allow: []\n');

  const { status, output } = run(['scan'], { SUPPLY_CHAIN_REPO_ROOT: root });
  assert.notEqual(status, 0);
  assert.match(output, /EXPIRED security exceptions/);
  assert.match(output, /2020-01-01/);
});

test('scan regenerates when the lockfile is newer than the SBOM', () => {
  const root = fakeRoot();
  const sbomDir = join(root, 'security', 'sbom');
  mkdirSync(sbomDir, { recursive: true });
  writeFileSync(join(sbomDir, 'yosemite-crew.cdx.json'), '{}');
  const past = new Date(Date.now() - 60_000);
  utimesSync(join(sbomDir, 'yosemite-crew.cdx.json'), past, past);
  // Lockfile written after the SBOM -> stale -> cmd_sbom runs -> which exits 2
  // on the missing node_modules, proving the regeneration path was taken.
  writeFileSync(join(root, 'pnpm-lock.yaml'), "lockfileVersion: '6.0'\n");

  const { status, output } = run(['scan'], { SUPPLY_CHAIN_REPO_ROOT: root });
  assert.equal(status, 2);
  assert.match(output, /SBOM missing or older than the lockfile - regenerating/);
  assert.match(output, /node_modules missing/);
});
