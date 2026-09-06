import { createRequire } from 'node:module';

type CodesignFlags = { hex: string; names: string[] };
type CodesignInfo = {
  authorities: string[];
  teamIdentifier: string | null;
  identifier: string | null;
  flags: CodesignFlags | null;
};
type Assessment = { ok: boolean; failures: string[] };
type RunResult = { status: number; output: string };
type VerifyModule = {
  ADHOC_FLAG: string;
  DEVELOPER_ID_AUTHORITY_PREFIX: string;
  UNSET_TEAM_IDENTIFIER: string;
  assessMacSignature: (input: Record<string, unknown>) => Assessment;
  formatReport: (target: string, assessment: Assessment) => string;
  hasDeveloperIdAuthority: (info: CodesignInfo) => boolean;
  hasTeamIdentifier: (info: CodesignInfo) => boolean;
  inspectArtifact: (target: string, deps?: Record<string, unknown>) => Record<string, unknown>;
  isAdHoc: (info: CodesignInfo) => boolean;
  parseCodesignInfo: (output: unknown) => CodesignInfo;
  verifyTargets: (
    targets: string[],
    deps?: Record<string, unknown>
  ) => { ok: boolean; results: { target: string; assessment: Assessment }[] };
};

const loadModule = (): VerifyModule => {
  const requireFromHere = createRequire(__filename);
  return requireFromHere('../scripts/verify-macos-signature.js') as VerifyModule;
};

// Structurally identical to real `codesign -dv --verbose=4` output on macOS 15
// (field order, the `flags=0x...(names)` shape, Authority repeated per chain
// element). Identity values are placeholders; the parser only reads structure.
const DEVELOPER_ID_OUTPUT = [
  'Executable=/Applications/Example.app/Contents/MacOS/Example',
  'Identifier=com.yosemitecrew.pims',
  'Format=app bundle with Mach-O universal (x86_64 arm64)',
  'CodeDirectory v=20500 size=308094 flags=0x10000(runtime) hashes=9617+7 location=embedded',
  'Signature size=9075',
  'Authority=Developer ID Application: Example Org (ABCDE12345)',
  'Authority=Developer ID Certification Authority',
  'Authority=Apple Root CA',
  'Timestamp=1 Jan 2026 at 00:00:00',
  'Notarization Ticket=stapled',
  'TeamIdentifier=ABCDE12345',
  'Sealed Resources version=2 rules=13 files=42',
].join('\n');

// What scripts/notarize.js produces when the Apple secrets are absent: it falls
// back to `codesign --sign -`, which yields the adhoc flag and no authority.
const AD_HOC_OUTPUT = [
  'Executable=/tmp/Probe.app/Contents/MacOS/Probe',
  'Identifier=com.yosemitecrew.pims',
  'Format=app bundle with Mach-O universal (x86_64 arm64e)',
  'CodeDirectory v=20500 size=306 flags=0x10002(adhoc,runtime) hashes=3+3 location=embedded',
  'Signature=adhoc',
  'TeamIdentifier=not set',
].join('\n');

const PASSING_EXIT_CODES = { verifyExitCode: 0, gatekeeperExitCode: 0, staplerExitCode: 0 };

describe('parseCodesignInfo', () => {
  it('reads every authority, the team identifier and the flag names', () => {
    const { parseCodesignInfo } = loadModule();
    const info = parseCodesignInfo(DEVELOPER_ID_OUTPUT);

    expect(info.authorities).toEqual([
      'Developer ID Application: Example Org (ABCDE12345)',
      'Developer ID Certification Authority',
      'Apple Root CA',
    ]);
    expect(info.teamIdentifier).toBe('ABCDE12345');
    expect(info.identifier).toBe('com.yosemitecrew.pims');
    expect(info.flags).toEqual({ hex: '0x10000', names: ['runtime'] });
  });

  it('splits multi-valued flags so adhoc is visible alongside runtime', () => {
    const { parseCodesignInfo } = loadModule();

    expect(parseCodesignInfo(AD_HOC_OUTPUT).flags).toEqual({
      hex: '0x10002',
      names: ['adhoc', 'runtime'],
    });
  });

  it('returns empty fields rather than throwing on absent or unparsable output', () => {
    const { parseCodesignInfo } = loadModule();

    for (const input of [undefined, null, '', 'code object is not signed at all']) {
      const info = parseCodesignInfo(input);
      expect(info.authorities).toEqual([]);
      expect(info.teamIdentifier).toBeNull();
      expect(info.flags).toBeNull();
    }
  });

  it('ignores a CodeDirectory line that carries no flags group', () => {
    const { parseCodesignInfo } = loadModule();

    expect(parseCodesignInfo('CodeDirectory v=20500 size=306').flags).toBeNull();
  });
});

describe('signature predicates', () => {
  it('separates a Developer ID chain from an ad-hoc signature', () => {
    const { parseCodesignInfo, isAdHoc, hasDeveloperIdAuthority, hasTeamIdentifier } = loadModule();
    const good = parseCodesignInfo(DEVELOPER_ID_OUTPUT);
    const adHoc = parseCodesignInfo(AD_HOC_OUTPUT);

    expect(isAdHoc(good)).toBe(false);
    expect(hasDeveloperIdAuthority(good)).toBe(true);
    expect(hasTeamIdentifier(good)).toBe(true);

    expect(isAdHoc(adHoc)).toBe(true);
    expect(hasDeveloperIdAuthority(adHoc)).toBe(false);
    expect(hasTeamIdentifier(adHoc)).toBe(false);
  });

  it('treats the literal "not set" team identifier as absent', () => {
    const { parseCodesignInfo, hasTeamIdentifier } = loadModule();

    expect(hasTeamIdentifier(parseCodesignInfo('TeamIdentifier=not set'))).toBe(false);
    expect(hasTeamIdentifier(parseCodesignInfo('TeamIdentifier=ABCDE12345'))).toBe(true);
  });

  it('does not accept a development or third-party authority as Developer ID', () => {
    const { parseCodesignInfo, hasDeveloperIdAuthority } = loadModule();
    const development = parseCodesignInfo('Authority=Apple Development: someone (ABCDE12345)');
    const installer = parseCodesignInfo(
      'Authority=Developer ID Installer: Example Org (ABCDE12345)'
    );

    expect(hasDeveloperIdAuthority(development)).toBe(false);
    expect(hasDeveloperIdAuthority(installer)).toBe(false);
  });

  // The substring class: output that CONTAINS the accepted text without being
  // the accepted thing. A check that searched the raw output rather than reading
  // the Authority field would pass all three of these.
  it('does not accept "Developer ID Application" appearing outside an Authority line', () => {
    const { parseCodesignInfo, hasDeveloperIdAuthority } = loadModule();
    const decoy = parseCodesignInfo(
      [
        'Executable=/Applications/Developer ID Application.app/Contents/MacOS/App',
        'Identifier=Developer ID Application',
        'CodeDirectory v=20500 size=306 flags=0x10002(adhoc,runtime) hashes=3+3 location=embedded',
        'TeamIdentifier=not set',
      ].join('\n')
    );

    expect(decoy.authorities).toEqual([]);
    expect(hasDeveloperIdAuthority(decoy)).toBe(false);
  });

  // Kills the `startsWith` -> `includes` weakening: an authority that CONTAINS
  // the accepted prefix without being it must not be accepted.
  it('requires the authority to start with the prefix, not merely contain it', () => {
    const { parseCodesignInfo, hasDeveloperIdAuthority } = loadModule();

    for (const authority of [
      'Authority=Not a Developer ID Application: Example Org (ABCDE12345)',
      'Authority=Untrusted Developer ID Application clone',
      'Authority=X-Developer ID Application: Example Org (ABCDE12345)',
    ]) {
      expect(hasDeveloperIdAuthority(parseCodesignInfo(authority))).toBe(false);
    }
  });

  // Kills the `Authority=` -> `Authority` weakening in the parser: only the
  // Authority field contributes, not any line that happens to say the word.
  it('collects authorities only from Authority= lines', () => {
    const { parseCodesignInfo } = loadModule();
    const info = parseCodesignInfo(
      [
        'Executable=/Applications/Certificate Authority Tool.app/Contents/MacOS/Tool',
        'Identifier=com.example.Authority',
        'Authority=Developer ID Application: Example Org (ABCDE12345)',
        'Sealed Resources Authority=decoy',
      ].join('\n')
    );

    expect(info.authorities).toEqual(['Developer ID Application: Example Org (ABCDE12345)']);
  });

  it('does not read "adhoc" from anywhere but the CodeDirectory flags', () => {
    const { parseCodesignInfo, isAdHoc } = loadModule();
    const decoy = parseCodesignInfo(
      [
        'Executable=/Applications/adhoc/Contents/MacOS/App',
        'CodeDirectory v=20500 size=308094 flags=0x10000(runtime) hashes=9617+7 location=embedded',
        'Authority=Developer ID Application: Example Org (ABCDE12345)',
        'TeamIdentifier=ABCDE12345',
      ].join('\n')
    );

    expect(isAdHoc(decoy)).toBe(false);
  });

  it('does not accept a team identifier that merely contains "not set"', () => {
    const { parseCodesignInfo, hasTeamIdentifier } = loadModule();

    expect(hasTeamIdentifier(parseCodesignInfo('TeamIdentifier=not settled'))).toBe(true);
    expect(hasTeamIdentifier(parseCodesignInfo('TeamIdentifier=not set'))).toBe(false);
  });

  it('is safe on a null info object', () => {
    const { isAdHoc, hasDeveloperIdAuthority, hasTeamIdentifier } = loadModule();

    expect(isAdHoc(null as unknown as CodesignInfo)).toBe(false);
    expect(hasDeveloperIdAuthority(null as unknown as CodesignInfo)).toBe(false);
    expect(hasTeamIdentifier(null as unknown as CodesignInfo)).toBe(false);
  });
});

describe('assessMacSignature', () => {
  it('accepts a Developer ID signed, Gatekeeper accepted, stapled artifact', () => {
    const { assessMacSignature, parseCodesignInfo } = loadModule();
    const assessment = assessMacSignature({
      info: parseCodesignInfo(DEVELOPER_ID_OUTPUT),
      ...PASSING_EXIT_CODES,
    });

    expect(assessment).toEqual({ ok: true, failures: [] });
  });

  // The regression this whole script exists for: `codesign --verify` exits 0 on
  // the ad-hoc bundle. Measured on macOS 15, not assumed. If the verdict were
  // ever reduced to that one call, this case would start passing.
  it('rejects the ad-hoc bundle even though codesign --verify exits 0', () => {
    const { assessMacSignature, parseCodesignInfo } = loadModule();
    const assessment = assessMacSignature({
      info: parseCodesignInfo(AD_HOC_OUTPUT),
      verifyExitCode: 0,
      gatekeeperExitCode: 3,
      staplerExitCode: 65,
    });

    expect(assessment.ok).toBe(false);
    expect(assessment.failures).toHaveLength(5);
    expect(assessment.failures.join('\n')).toContain('ad-hoc signed');
  });

  it('reports every failing condition rather than only the first', () => {
    const { assessMacSignature, parseCodesignInfo } = loadModule();
    const assessment = assessMacSignature({
      info: parseCodesignInfo(''),
      verifyExitCode: 1,
      gatekeeperExitCode: 3,
      staplerExitCode: 65,
    });

    expect(assessment.failures).toHaveLength(5);
  });

  it('fails each condition independently while the others pass', () => {
    const { assessMacSignature, parseCodesignInfo } = loadModule();
    const good = parseCodesignInfo(DEVELOPER_ID_OUTPUT);

    expect(
      assessMacSignature({ info: good, ...PASSING_EXIT_CODES, verifyExitCode: 1 }).failures
    ).toEqual([expect.stringContaining('codesign --verify')]);
    expect(
      assessMacSignature({ info: good, ...PASSING_EXIT_CODES, gatekeeperExitCode: 3 }).failures
    ).toEqual([expect.stringContaining('spctl')]);
    expect(
      assessMacSignature({ info: good, ...PASSING_EXIT_CODES, staplerExitCode: 65 }).failures
    ).toEqual([expect.stringContaining('stapler validate')]);
  });

  it('skips only the stapling condition when notarization is not required', () => {
    const { assessMacSignature, parseCodesignInfo } = loadModule();
    const assessment = assessMacSignature({
      info: parseCodesignInfo(DEVELOPER_ID_OUTPUT),
      ...PASSING_EXIT_CODES,
      staplerExitCode: 65,
      requireNotarization: false,
    });

    expect(assessment).toEqual({ ok: true, failures: [] });
  });

  it('still requires a Developer ID chain when notarization is not required', () => {
    const { assessMacSignature, parseCodesignInfo } = loadModule();
    const assessment = assessMacSignature({
      info: parseCodesignInfo(AD_HOC_OUTPUT),
      ...PASSING_EXIT_CODES,
      requireNotarization: false,
    });

    expect(assessment.ok).toBe(false);
  });

  // An unverified artifact and a verified one must not produce the same verdict.
  it('fails closed when called with no arguments at all', () => {
    const { assessMacSignature } = loadModule();

    expect(assessMacSignature().ok).toBe(false);
    expect(assessMacSignature({}).ok).toBe(false);
  });
});

describe('formatReport', () => {
  it('states the three properties that were established on success', () => {
    const { formatReport } = loadModule();
    const report = formatReport('Example.app', { ok: true, failures: [] });

    expect(report).toContain('Developer ID signed');
    expect(report).toContain('Gatekeeper');
    expect(report).toContain('notarization stapled');
  });

  it('lists each failure under a FAILED heading', () => {
    const { formatReport } = loadModule();
    const report = formatReport('Example.app', { ok: false, failures: ['first', 'second'] });

    expect(report).toContain('Example.app: FAILED');
    expect(report.split('\n')).toEqual([
      '[verify-macos-signature] Example.app: FAILED',
      '  - first',
      '  - second',
    ]);
  });
});

describe('inspectArtifact', () => {
  const stubRun = (byCommand: Record<string, RunResult>) => {
    const calls: { command: string; args: string[] }[] = [];
    const run = (command: string, args: string[]): RunResult => {
      calls.push({ command, args });
      const key = command === 'xcrun' ? `xcrun ${args[0]}` : command;
      const match = command === 'codesign' && args.includes('--verify') ? 'codesign --verify' : key;
      return byCommand[match] ?? { status: 0, output: '' };
    };
    return { run, calls };
  };

  it('runs all four checks and returns their exit codes', () => {
    const { inspectArtifact } = loadModule();
    const { run, calls } = stubRun({
      codesign: { status: 0, output: DEVELOPER_ID_OUTPUT },
      'codesign --verify': { status: 0, output: 'valid on disk' },
      spctl: { status: 0, output: 'accepted' },
      'xcrun stapler': { status: 0, output: 'The validate action worked!' },
    });

    const result = inspectArtifact('Example.app', { run });

    expect(calls.map((call) => call.command)).toEqual(['codesign', 'codesign', 'spctl', 'xcrun']);
    expect(result.verifyExitCode).toBe(0);
    expect(result.gatekeeperExitCode).toBe(0);
    expect(result.staplerExitCode).toBe(0);
    expect((result.info as CodesignInfo).teamIdentifier).toBe('ABCDE12345');
  });

  // Every tool must see the artifact; a check that silently inspected something
  // else would report a verdict about the wrong file.
  it('passes the target through to every tool', () => {
    const { inspectArtifact } = loadModule();
    const { run, calls } = stubRun({});

    inspectArtifact('Some Artifact.dmg', { run });

    expect(calls).toHaveLength(4);
    for (const call of calls) {
      expect(call.args).toContain('Some Artifact.dmg');
    }
  });

  it('does not short-circuit when an early check fails', () => {
    const { inspectArtifact } = loadModule();
    const { run, calls } = stubRun({ 'codesign --verify': { status: 1, output: 'not signed' } });

    const result = inspectArtifact('Example.app', { run });

    expect(calls).toHaveLength(4);
    expect(result.verifyExitCode).toBe(1);
  });
});

describe('the default runner (fail-closed)', () => {
  it('concatenates stdout and stderr, because codesign reports on stderr', () => {
    const { inspectArtifact } = loadModule();
    const spawnSync = jest.fn().mockReturnValue({
      status: 0,
      stdout: '',
      stderr: DEVELOPER_ID_OUTPUT,
    });

    const result = inspectArtifact('Example.app', { spawnSync });

    expect((result.info as CodesignInfo).teamIdentifier).toBe('ABCDE12345');
  });

  it('throws rather than reporting a pass when the tool cannot be launched', () => {
    const { inspectArtifact } = loadModule();
    const spawnSync = jest.fn().mockReturnValue({ error: new Error('spawn ENOENT') });

    expect(() => inspectArtifact('Example.app', { spawnSync })).toThrow(/Could not run codesign/);
  });

  it('throws when a tool is killed by a signal and leaves a null status', () => {
    const { inspectArtifact } = loadModule();
    const spawnSync = jest.fn().mockReturnValue({ status: null, stdout: '', stderr: '' });

    expect(() => inspectArtifact('Example.app', { spawnSync })).toThrow(/terminated before/);
  });

  it('tolerates a tool that produces neither stdout nor stderr', () => {
    const { inspectArtifact } = loadModule();
    const spawnSync = jest.fn().mockReturnValue({ status: 1 });

    const result = inspectArtifact('Example.app', { spawnSync });

    expect(result.verifyExitCode).toBe(1);
    expect((result.info as CodesignInfo).authorities).toEqual([]);
  });
});

describe('main', () => {
  it('returns 0 only when every artifact verifies', () => {
    const { main } = loadModule();
    const log = jest.fn();
    const run = () => ({ status: 0, output: DEVELOPER_ID_OUTPUT });

    expect(main(['node', 'script', 'a.app'], { run, log })).toBe(0);
  });

  it('returns 1 when no artifact was named, rather than reporting success', () => {
    const { main } = loadModule();
    const error = jest.fn();

    expect(main(['node', 'script'], { error })).toBe(1);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
  });

  it('returns 1 and reports when a tool throws, rather than propagating', () => {
    const { main } = loadModule();
    const error = jest.fn();
    const run = () => {
      throw new Error('spctl is missing');
    };

    expect(main(['node', 'script', 'a.app'], { run, error })).toBe(1);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('spctl is missing'));
  });

  it('returns 1 for an ad-hoc signed artifact', () => {
    const { main } = loadModule();
    const log = jest.fn();
    const run = (command: string, args: string[]): RunResult => {
      if (command === 'codesign' && !args.includes('--verify')) {
        return { status: 0, output: AD_HOC_OUTPUT };
      }
      if (command === 'codesign') return { status: 0, output: '' };
      return { status: 3, output: '' };
    };

    expect(main(['node', 'script', 'a.app'], { run, log })).toBe(1);
  });
});

describe('verifyTargets', () => {
  const runFor =
    (output: string, statuses: Record<string, number>) =>
    (command: string, args: string[]): RunResult => {
      if (command === 'codesign' && !args.includes('--verify')) return { status: 0, output };
      if (command === 'codesign') return { status: statuses.verify ?? 0, output: '' };
      if (command === 'spctl') return { status: statuses.spctl ?? 0, output: '' };
      return { status: statuses.stapler ?? 0, output: '' };
    };

  it('is ok only when every target passes', () => {
    const { verifyTargets } = loadModule();
    const log = jest.fn();

    const passing = verifyTargets(['a.app', 'b.dmg'], {
      run: runFor(DEVELOPER_ID_OUTPUT, {}),
      log,
    });

    expect(passing.ok).toBe(true);
    expect(passing.results).toHaveLength(2);
    expect(log).toHaveBeenCalledTimes(2);
  });

  it('fails the whole run when a single target is ad-hoc signed', () => {
    const { verifyTargets } = loadModule();
    const log = jest.fn();
    let call = 0;
    const run = (command: string, args: string[]): RunResult => {
      // First target good, second ad-hoc.
      const output = call < 4 ? DEVELOPER_ID_OUTPUT : AD_HOC_OUTPUT;
      const statuses = call < 4 ? {} : { spctl: 3, stapler: 65 };
      call += 1;
      return runFor(output, statuses)(command, args);
    };

    const result = verifyTargets(['good.app', 'adhoc.app'], { run, log });

    expect(result.ok).toBe(false);
    expect(result.results[0].assessment.ok).toBe(true);
    expect(result.results[1].assessment.ok).toBe(false);
  });

  it('honours requireNotarization: false end to end', () => {
    const { verifyTargets } = loadModule();
    const log = jest.fn();

    const result = verifyTargets(['a.app'], {
      run: runFor(DEVELOPER_ID_OUTPUT, { stapler: 65 }),
      log,
      requireNotarization: false,
    });

    expect(result.ok).toBe(true);
  });
});
