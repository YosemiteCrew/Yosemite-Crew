import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * The budget script decides CI pass/fail for every chunk category, so a change to
 * its thresholds or its filename-to-category rules can silently disable the
 * guardrail. These tests build a throwaway `.next/static/chunks` tree and run the
 * real script against it, because the classification lives in filename patterns
 * that only a real directory exercises.
 */

const SCRIPT = path.resolve(__dirname, '../../../../scripts/check-bundle-budgets.mjs');

// Mirrors the constants in the script. Kept here deliberately: if a threshold
// moves, the just-under and just-over cases below stop straddling it and fail,
// which is the point.
const BUDGETS = {
  page: 375 * 1024,
  async: 1190 * 1024,
  shared: 195 * 1024,
  polyfills: 120 * 1024,
} as const;

type Chunk = { name: string; size: number };

let workdir: string;

const run = (chunks: Chunk[]) => {
  const chunkDir = path.join(workdir, '.next', 'static', 'chunks');
  rmSync(path.join(workdir, '.next'), { recursive: true, force: true });
  mkdirSync(path.join(chunkDir, 'app'), { recursive: true });

  for (const { name, size } of chunks) {
    const file = path.join(chunkDir, name);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, Buffer.alloc(size, 'x'));
  }

  try {
    const stdout = execFileSync('node', [SCRIPT], { cwd: workdir, encoding: 'utf8' });
    return { code: 0, output: stdout };
  } catch (error) {
    const failure = error as { status: number; stdout: string; stderr: string };
    return { code: failure.status, output: `${failure.stdout}${failure.stderr}` };
  }
};

beforeAll(() => {
  workdir = mkdtempSync(path.join(tmpdir(), 'yc-budgets-'));
});

afterAll(() => {
  rmSync(workdir, { recursive: true, force: true });
});

describe('check-bundle-budgets', () => {
  it.each([
    ['page', 'app/(routes)/(app)/dashboard/page-abc123.js', BUDGETS.page],
    ['async', '1760.6badaf4387a5d3c8.js', BUDGETS.async],
    ['shared', 'framework-63182ecd18a3b3c9.js', BUDGETS.shared],
    ['polyfills', 'polyfills-42372ed130431b0a.js', BUDGETS.polyfills],
  ])('passes a %s chunk that is just under budget', (_category, name, budget) => {
    const result = run([{ name, size: budget - 1024 }]);

    expect(result.code).toBe(0);
    expect(result.output).toContain('Bundle budget check passed');
  });

  it.each([
    ['page', 'app/(routes)/(app)/dashboard/page-abc123.js', BUDGETS.page],
    ['async', '1760.6badaf4387a5d3c8.js', BUDGETS.async],
    ['shared', 'main-63182ecd18a3b3c9.js', BUDGETS.shared],
    ['polyfills', 'polyfills-42372ed130431b0a.js', BUDGETS.polyfills],
  ])('fails a %s chunk that is just over budget', (_category, name, budget) => {
    const result = run([{ name, size: budget + 1024 }]);

    expect(result.code).toBe(1);
    expect(result.output).toContain('Bundle budget check failed');
    expect(result.output).toContain(path.basename(name));
  });

  it('holds each category to its own budget rather than the largest one', () => {
    // A shared chunk at async size must fail: if the categories ever collapse to
    // one threshold, this is what catches it.
    const result = run([{ name: 'framework-abc.js', size: BUDGETS.shared + 1024 }]);

    expect(result.code).toBe(1);
    expect(result.output).toContain('framework-abc.js');
  });

  it('reports every offender, not just the first', () => {
    const result = run([
      { name: 'polyfills-a.js', size: BUDGETS.polyfills + 1024 },
      { name: 'framework-b.js', size: BUDGETS.shared + 1024 },
    ]);

    expect(result.code).toBe(1);
    expect(result.output).toContain('polyfills-a.js');
    expect(result.output).toContain('framework-b.js');
  });

  it('fails when there is no build to measure, rather than passing vacuously', () => {
    rmSync(path.join(workdir, '.next'), { recursive: true, force: true });
    mkdirSync(path.join(workdir, '.next', 'static', 'chunks'), { recursive: true });

    const result = run([]);

    expect(result.code).not.toBe(0);
    expect(result.output).toContain('No JS bundles found');
  });
});
