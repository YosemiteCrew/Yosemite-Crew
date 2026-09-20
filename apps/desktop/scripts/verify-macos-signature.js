'use strict';

const childProcess = require('node:child_process');

// Verifies that a built macOS artifact carries a real Developer ID signature and
// a stapled notarization ticket, and fails the release build when it does not.
//
// Why this exists at all: nothing in desktop-release.yml verified a signature.
// A green macOS job proved only that signing did not throw, which is a weaker
// claim than it reads as, because the build has a path that produces an
// unsigned-but-plausible artifact. scripts/notarize.js ad-hoc signs the bundle
// (`codesign --sign -`) whenever APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD /
// APPLE_TEAM_ID are absent, so a release run with a revoked or missing Apple
// secret produces an .app that looks signed to the most obvious check.
//
// Measured on macOS 15 (arm64), Developer ID + notarized app vs the ad-hoc
// bundle that path produces:
//
//   check                                  Developer ID   ad-hoc   unsigned
//   codesign --verify --deep --strict      rc=0           rc=0     rc=1
//   spctl -a -t exec                       rc=0           rc=3     rc=3
//   stapler validate                       rc=0           rc=65    rc=65
//   Authority=Developer ID Application     present        absent   absent
//   CodeDirectory flags                    runtime        adhoc,runtime
//   TeamIdentifier                         set            "not set"
//
// `codesign --verify` is rc=0 on the ad-hoc bundle. It is the check most
// reached for and it is blind to the one failure this repo can actually
// produce, so the verdict below is a conjunction and never that call alone.

const ADHOC_FLAG = 'adhoc';
const DEVELOPER_ID_AUTHORITY_PREFIX = 'Developer ID Application';
const UNSET_TEAM_IDENTIFIER = 'not set';

// `codesign -dv --verbose=4` writes to stderr. Only the fields asserted on are
// read; unknown lines are ignored so a macOS release cannot fail the build by
// adding one.
const parseCodesignInfo = (output) => {
  const info = { authorities: [], teamIdentifier: null, identifier: null, flags: null };

  for (const rawLine of String(output == null ? '' : output).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith('Authority=')) {
      info.authorities.push(line.slice('Authority='.length).trim());
    } else if (line.startsWith('TeamIdentifier=')) {
      info.teamIdentifier = line.slice('TeamIdentifier='.length).trim();
    } else if (line.startsWith('Identifier=')) {
      info.identifier = line.slice('Identifier='.length).trim();
    } else if (line.startsWith('CodeDirectory ')) {
      // e.g. `CodeDirectory v=20500 size=306 flags=0x10002(adhoc,runtime) ...`
      const match = /flags=(0x[0-9a-fA-F]+)\(([^)]*)\)/.exec(line);
      if (match) {
        info.flags = {
          hex: match[1],
          names: match[2]
            .split(',')
            .map((name) => name.trim())
            .filter(Boolean),
        };
      }
    }
  }

  return info;
};

const isAdHoc = (info) => Boolean(info && info.flags && info.flags.names.includes(ADHOC_FLAG));

const hasDeveloperIdAuthority = (info) =>
  Boolean(
    info &&
    info.authorities.some((authority) => authority.startsWith(DEVELOPER_ID_AUTHORITY_PREFIX))
  );

const hasTeamIdentifier = (info) =>
  Boolean(info && info.teamIdentifier && info.teamIdentifier !== UNSET_TEAM_IDENTIFIER);

// Every condition is reported, not just the first, so one run names every reason
// the artifact is unacceptable rather than making the release chase them singly.
const assessMacSignature = ({
  info,
  verifyExitCode,
  gatekeeperExitCode,
  staplerExitCode,
  requireNotarization = true,
} = {}) => {
  const parsed = info || parseCodesignInfo('');
  const failures = [];

  if (verifyExitCode !== 0) {
    failures.push(`codesign --verify --deep --strict failed (exit ${verifyExitCode}).`);
  }
  if (isAdHoc(parsed)) {
    failures.push(
      'The bundle is ad-hoc signed. scripts/notarize.js does this when the Apple secrets are ' +
        'absent, so treat this as a missing or rejected Developer ID credential.'
    );
  }
  if (!hasDeveloperIdAuthority(parsed)) {
    failures.push(`No "${DEVELOPER_ID_AUTHORITY_PREFIX}" authority in the certificate chain.`);
  }
  if (!hasTeamIdentifier(parsed)) {
    failures.push('TeamIdentifier is not set on the signature.');
  }
  if (gatekeeperExitCode !== 0) {
    failures.push(`spctl assessment rejected the artifact (exit ${gatekeeperExitCode}).`);
  }
  if (requireNotarization && staplerExitCode !== 0) {
    failures.push(
      `stapler validate found no stapled notarization ticket (exit ${staplerExitCode}).`
    );
  }

  return { ok: failures.length === 0, failures };
};

const formatReport = (target, assessment) => {
  if (assessment.ok) {
    return `[verify-macos-signature] ${target}: Developer ID signed, accepted by Gatekeeper, notarization stapled.`;
  }
  const lines = assessment.failures.map((failure) => `  - ${failure}`);
  return [`[verify-macos-signature] ${target}: FAILED`, ...lines].join('\n');
};

// The three tools are run unconditionally rather than short-circuiting on the
// first failure, so the report names every problem the artifact has.
const inspectArtifact = (target, deps = {}) => {
  const spawnSync = deps.spawnSync || childProcess.spawnSync;
  const run =
    deps.run ||
    ((command, args) => {
      const result = spawnSync(command, args, { encoding: 'utf8' });
      // A tool that could not be launched at all must not be reported as a
      // passing check. `spawnSync` signals that through `error`, and a null
      // status (killed by a signal) is not a zero exit either.
      if (result.error) {
        throw new Error(`Could not run ${command}: ${result.error.message}`);
      }
      if (result.status === null) {
        throw new Error(`${command} was terminated before it produced an exit code.`);
      }
      // codesign and spctl write their detail to stderr, not stdout.
      return { status: result.status, output: `${result.stdout || ''}${result.stderr || ''}` };
    });

  const describe = run('codesign', ['-dv', '--verbose=4', target]);
  const verify = run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', target]);
  const gatekeeper = run('spctl', ['-a', '-t', 'exec', '-vv', target]);
  const stapler = run('xcrun', ['stapler', 'validate', target]);

  return {
    info: parseCodesignInfo(describe.output),
    verifyExitCode: verify.status,
    gatekeeperExitCode: gatekeeper.status,
    staplerExitCode: stapler.status,
  };
};

const verifyTargets = (targets, deps = {}) => {
  const log = deps.log || console.log;
  const requireNotarization = deps.requireNotarization !== false;
  const results = targets.map((target) => {
    const assessment = assessMacSignature({
      ...inspectArtifact(target, deps),
      requireNotarization,
    });
    log(formatReport(target, assessment));
    return { target, assessment };
  });

  return { ok: results.every((result) => result.assessment.ok), results };
};

// Returns a process exit code. A missing tool, an unreadable artifact and an
// empty argument list all have to be failures: an unverified artifact and a
// verified one must never leave the same exit code behind.
const main = (argv, deps = {}) => {
  const error = deps.error || console.error;
  const targets = argv.slice(2);

  if (targets.length === 0) {
    error('Usage: node scripts/verify-macos-signature.js <artifact> [artifact...]');
    return 1;
  }

  try {
    return verifyTargets(targets, deps).ok ? 0 : 1;
  } catch (thrown) {
    error(`[verify-macos-signature] ${thrown.message || thrown}`);
    return 1;
  }
};

module.exports = {
  ADHOC_FLAG,
  DEVELOPER_ID_AUTHORITY_PREFIX,
  UNSET_TEAM_IDENTIFIER,
  assessMacSignature,
  formatReport,
  hasDeveloperIdAuthority,
  hasTeamIdentifier,
  inspectArtifact,
  isAdHoc,
  main,
  parseCodesignInfo,
  verifyTargets,
};

if (require.main === module) {
  process.exitCode = main(process.argv);
}
