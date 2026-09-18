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

const run = (
  chunks: Chunk[],
  options?: { buildManifest?: object; htmlFiles?: Array<{ path: string; content: string }> }
) => {
  const nextDir = path.join(workdir, '.next');
  const chunkDir = path.join(nextDir, 'static', 'chunks');
  const serverDir = path.join(nextDir, 'server');
  rmSync(nextDir, { recursive: true, force: true });
  mkdirSync(path.join(chunkDir, 'app'), { recursive: true });
  mkdirSync(serverDir, { recursive: true });

  if (options?.buildManifest) {
    writeFileSync(path.join(nextDir, 'build-manifest.json'), JSON.stringify(options.buildManifest));
  }

  if (options?.htmlFiles) {
    for (const { path: htmlPath, content } of options.htmlFiles) {
      const fullPath = path.join(serverDir, htmlPath);
      mkdirSync(path.dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, content);
    }
  }

  for (const { name, size } of chunks) {
    const file = path.join(chunkDir, name);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, Buffer.alloc(size, 'x'));
  }

  try {
    const stdout = execFileSync('node', [SCRIPT], {
      cwd: workdir,
      encoding: 'utf8',
      env: { ...process.env, NEXT_BUILD_DIR: workdir },
    });
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
  describe('webpack-style classification (legacy)', () => {
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
  });

  describe('Turbopack-style classification (build-manifest + HTML reachability)', () => {
    const buildManifest = {
      polyfillFiles: ['static/chunks/polyfill-abc123.js'],
      rootMainFiles: ['static/chunks/main-xyz789.js', 'static/chunks/app-pages-internals-abc.js'],
    };

    const htmlFiles = [
      {
        path: 'app/(routes)/(app)/dashboard/page.html',
        content:
          '<html><head><script src="/_next/static/chunks/main-xyz789.js"></script><script src="/_next/static/chunks/1760.6badaf4387a5d3c8.js"></script></head></html>',
      },
      {
        path: 'app/(routes)/(app)/settings/page.html',
        content:
          '<html><head><script src="/_next/static/chunks/main-xyz789.js"></script><script src="/_next/static/chunks/abcdef1234567890.js"></script></head></html>',
      },
    ];

    it('classifies polyfillFiles as polyfills', () => {
      const result = run([{ name: 'polyfill-abc123.js', size: BUDGETS.polyfills - 1024 }], {
        buildManifest,
        htmlFiles,
      });

      expect(result.code).toBe(0);
      expect(result.output).toContain('Bundle budget check passed');
    });

    it('fails polyfillFiles over polyfills budget', () => {
      const result = run([{ name: 'polyfill-abc123.js', size: BUDGETS.polyfills + 1024 }], {
        buildManifest,
        htmlFiles,
      });

      expect(result.code).toBe(1);
      expect(result.output).toContain('polyfill-abc123.js');
      expect(result.output).toContain('(polyfills)');
    });

    it('classifies rootMainFiles as shared', () => {
      const result = run([{ name: 'main-xyz789.js', size: BUDGETS.shared - 1024 }], {
        buildManifest,
        htmlFiles,
      });

      expect(result.code).toBe(0);
      expect(result.output).toContain('Bundle budget check passed');
    });

    it('fails rootMainFiles over shared budget', () => {
      const result = run([{ name: 'main-xyz789.js', size: BUDGETS.shared + 1024 }], {
        buildManifest,
        htmlFiles,
      });

      expect(result.code).toBe(1);
      expect(result.output).toContain('main-xyz789.js');
      expect(result.output).toContain('(shared)');
    });

    it('classifies chunks referenced in prerendered HTML as page', () => {
      const result = run([{ name: '1760.6badaf4387a5d3c8.js', size: BUDGETS.page - 1024 }], {
        buildManifest,
        htmlFiles,
      });

      expect(result.code).toBe(0);
      expect(result.output).toContain('Bundle budget check passed');
    });

    it('fails page chunks over page budget', () => {
      const result = run([{ name: '1760.6badaf4387a5d3c8.js', size: BUDGETS.page + 1024 }], {
        buildManifest,
        htmlFiles,
      });

      expect(result.code).toBe(1);
      expect(result.output).toContain('1760.6badaf4387a5d3c8.js');
      expect(result.output).toContain('(page)');
    });

    it('classifies unreferenced chunks as async', () => {
      const result = run([{ name: 'lazy-chunk-abcdef123456.js', size: BUDGETS.async - 1024 }], {
        buildManifest,
        htmlFiles,
      });

      expect(result.code).toBe(0);
      expect(result.output).toContain('Bundle budget check passed');
    });

    it('fails async chunks over async budget', () => {
      const result = run([{ name: 'lazy-chunk-abcdef123456.js', size: BUDGETS.async + 1024 }], {
        buildManifest,
        htmlFiles,
      });

      expect(result.code).toBe(1);
      expect(result.output).toContain('lazy-chunk-abcdef123456.js');
      expect(result.output).toContain('(async)');
    });
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

  it('uses legacy filename-based classification when no build-manifest or HTML is available', () => {
    rmSync(path.join(workdir, '.next'), { recursive: true, force: true });
    mkdirSync(path.join(workdir, '.next', 'static', 'chunks'), { recursive: true });
    writeFileSync(
      path.join(workdir, '.next', 'static', 'chunks', 'some-chunk.js'),
      Buffer.alloc(1024, 'x')
    );

    const result = run([{ name: 'some-chunk.js', size: 1024 }]);

    expect(result.code).toBe(0);
    expect(result.output).toContain('Bundle budget check passed');
  });
});
