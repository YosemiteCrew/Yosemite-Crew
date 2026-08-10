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

test('scan fails when an ignore-packages entry lacks a dated re-review line', () => {
  const root = fakeRoot();
  // A current SBOM (newer than the lockfile refs) so staleness passes and the
  // undated-exception guard is what trips.
  writeFileSync(join(root, 'pnpm-lock.yaml'), "lockfileVersion: '6.0'\n");
  writeFileSync(join(root, 'package.json'), '{}\n');
  const sbomDir = join(root, 'security', 'sbom');
  mkdirSync(sbomDir, { recursive: true });
  writeFileSync(join(sbomDir, 'yosemite-crew.cdx.json'), '{}');
  const past = new Date(Date.now() - 60_000);
  utimesSync(join(root, 'pnpm-lock.yaml'), past, past);
  utimesSync(join(root, 'package.json'), past, past);
  writeFileSync(join(root, '.grype.yaml'), 'ignore: []\n');
  writeFileSync(
    join(root, '.grant.yaml'),
    [
      'allow: []',
      'ignore-packages:',
      '  # Dated entry, fine. Re-review by: 2999-01-01.',
      '  - compliant-pkg',
      '  # Re-review: on version bump.',
      '  - missing-date-pkg',
      '',
    ].join('\n')
  );

  const { status, output } = run(['scan'], { SUPPLY_CHAIN_REPO_ROOT: root });
  assert.notEqual(status, 0);
  assert.match(output, /UNDATED security exceptions/);
  assert.match(output, /missing-date-pkg/);
  assert.doesNotMatch(output, /compliant-pkg/);
});

test('scan regenerates when the native gradle lockfile is newer than the SBOM', () => {
  const root = fakeRoot();
  const sbomDir = join(root, 'security', 'sbom');
  mkdirSync(sbomDir, { recursive: true });
  writeFileSync(join(sbomDir, 'yosemite-crew.cdx.json'), '{}');
  const past = new Date(Date.now() - 60_000);
  utimesSync(join(sbomDir, 'yosemite-crew.cdx.json'), past, past);
  // Only the android gradle.lockfile is written after the SBOM -> stale ->
  // cmd_sbom runs -> which exits 2 on the missing node_modules, proving the
  // native lockfile alone drives regeneration.
  const gradleDir = join(root, 'apps', 'mobileAppYC', 'android', 'app');
  mkdirSync(gradleDir, { recursive: true });
  writeFileSync(join(gradleDir, 'gradle.lockfile'), 'empty=\n');

  const { status, output } = run(['scan'], { SUPPLY_CHAIN_REPO_ROOT: root });
  assert.equal(status, 2);
  assert.match(output, /SBOM missing or older than the lockfile - regenerating/);
  assert.match(output, /node_modules missing/);
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

test('a grype ignore entry without a dated re-review line fails the scan', () => {
  const root = fakeRoot();
  writeFileSync(join(root, 'pnpm-lock.yaml'), "lockfileVersion: '6.0'\n");
  writeFileSync(join(root, 'package.json'), '{}\n');
  const sbomDir = join(root, 'security', 'sbom');
  mkdirSync(sbomDir, { recursive: true });
  writeFileSync(join(sbomDir, 'yosemite-crew.cdx.json'), '{}');
  const past = new Date(Date.now() - 60_000);
  utimesSync(join(root, 'pnpm-lock.yaml'), past, past);
  utimesSync(join(root, 'package.json'), past, past);
  writeFileSync(
    join(root, '.grype.yaml'),
    'ignore:\n' +
      '  # Not reachable in our usage. Owner: ankit-yc.\n' +
      '  - vulnerability: GHSA-xxxx-xxxx-xxxx\n' +
      '    package:\n' +
      '      name: foo\n'
  );
  writeFileSync(join(root, '.grant.yaml'), 'allow: []\n');

  const { status, output } = run(['scan'], { SUPPLY_CHAIN_REPO_ROOT: root });
  assert.notEqual(status, 0);
  assert.match(output, /UNDATED security exceptions in \.grype\.yaml/);
  assert.match(output, /GHSA-xxxx-xxxx-xxxx/);
});

test('an undated grype ignore in column-0 sequence layout still fails', () => {
  const root = fakeRoot();
  writeFileSync(join(root, 'pnpm-lock.yaml'), "lockfileVersion: '6.0'\n");
  writeFileSync(join(root, 'package.json'), '{}\n');
  const sbomDir = join(root, 'security', 'sbom');
  mkdirSync(sbomDir, { recursive: true });
  writeFileSync(join(sbomDir, 'yosemite-crew.cdx.json'), '{}');
  const past = new Date(Date.now() - 60_000);
  utimesSync(join(root, 'pnpm-lock.yaml'), past, past);
  utimesSync(join(root, 'package.json'), past, past);
  // Valid YAML: sequence items at the same indent as the key.
  writeFileSync(
    join(root, '.grype.yaml'),
    'ignore:\n' + '- vulnerability: GHSA-col0-col0-col0\n' + '  package:\n' + '    name: foo\n'
  );
  writeFileSync(join(root, '.grant.yaml'), 'allow: []\n');

  const { status, output } = run(['scan'], { SUPPLY_CHAIN_REPO_ROOT: root });
  assert.notEqual(status, 0);
  assert.match(output, /UNDATED security exceptions in \.grype\.yaml/);
  assert.match(output, /GHSA-col0-col0-col0/);
});

test('a non-empty flow-style ignore sequence is rejected as unsupported', () => {
  const root = fakeRoot();
  writeFileSync(join(root, 'pnpm-lock.yaml'), "lockfileVersion: '6.0'\n");
  writeFileSync(join(root, 'package.json'), '{}\n');
  const sbomDir = join(root, 'security', 'sbom');
  mkdirSync(sbomDir, { recursive: true });
  writeFileSync(join(sbomDir, 'yosemite-crew.cdx.json'), '{}');
  const past = new Date(Date.now() - 60_000);
  utimesSync(join(root, 'pnpm-lock.yaml'), past, past);
  utimesSync(join(root, 'package.json'), past, past);
  writeFileSync(join(root, '.grype.yaml'), 'ignore: [{vulnerability: GHSA-flow-flow-flow}]\n');
  writeFileSync(join(root, '.grant.yaml'), 'allow: []\n');

  const { status, output } = run(['scan'], { SUPPLY_CHAIN_REPO_ROOT: root });
  assert.notEqual(status, 0);
  assert.match(output, /UNSUPPORTED layout for 'ignore:' in \.grype\.yaml/);
});

test('the header example placeholder never trips the expiry or date guards', () => {
  const root = fakeRoot();
  writeFileSync(join(root, 'pnpm-lock.yaml'), "lockfileVersion: '6.0'\n");
  writeFileSync(join(root, 'package.json'), '{}\n');
  const sbomDir = join(root, 'security', 'sbom');
  mkdirSync(sbomDir, { recursive: true });
  writeFileSync(join(sbomDir, 'yosemite-crew.cdx.json'), '{}');
  const past = new Date(Date.now() - 60_000);
  utimesSync(join(root, 'pnpm-lock.yaml'), past, past);
  utimesSync(join(root, 'package.json'), past, past);
  // Mirrors the real .grype.yaml header: a commented example whose date is the
  // YYYY-MM-DD placeholder. A literal date here once made every scan fail the
  // day the sample "expired".
  writeFileSync(
    join(root, '.grype.yaml'),
    '# Example:\n' +
      '# ignore:\n' +
      '#   # reason here. Owner: someone.\n' +
      '#   # Re-review by: YYYY-MM-DD.\n' +
      '#   - vulnerability: GHSA-xxxx-xxxx-xxxx\n' +
      'ignore: []\n'
  );
  writeFileSync(join(root, '.grant.yaml'), 'allow: []\n');

  const { status, output } = run(['scan'], { SUPPLY_CHAIN_REPO_ROOT: root });
  assert.equal(status, 0, `scan should pass, got: ${output}`);
});

test('a tampered download is rejected by the pinned digest', () => {
  const root = fakeRoot({ syft: '1.50.0', grant: '0.6.8' }); // no grype -> install path
  // Stub curl that "downloads" attacker-controlled bytes.
  const fakeBin = join(root, 'fake-path');
  mkdirSync(fakeBin, { recursive: true });
  writeFileSync(
    join(fakeBin, 'curl'),
    '#!/usr/bin/env bash\nout=""\nwhile [ $# -gt 0 ]; do if [ "$1" = "-o" ]; then out="$2"; shift; fi; shift; done\necho "malicious payload" > "$out"\n',
    { mode: 0o755 }
  );
  const { status, output } = run(['scan'], {
    SUPPLY_CHAIN_REPO_ROOT: root,
    PATH: `${fakeBin}:${process.env.PATH}`,
  });
  assert.notEqual(status, 0);
  assert.match(output, /DIGEST MISMATCH/);
});
