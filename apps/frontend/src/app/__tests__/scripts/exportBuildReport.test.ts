import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * `export-build-report.mjs` runs as its own CI step immediately after the budget
 * check, with no `continue-on-error`. It read `.next/app-build-manifest.json`
 * with no existence check, and Next 16 removed that file (issue #3266), so the
 * step failed under either bundler on the major. These tests run the real script
 * against a throwaway `.next` tree and cover both sources plus the case where
 * neither is present - the failure has to stay loud, because the alternative
 * that was tried on the way here was a script that wrote an empty report and
 * exited 0.
 */

const SCRIPT = path.resolve(__dirname, '../../../../scripts/export-build-report.mjs');

type Document = { route: string; chunks: string[] };

type Fixture = {
  /** Chunk paths relative to `.next`, written with a size derived from the name. */
  chunks?: Record<string, number>;
  /** `null` omits app-build-manifest.json, which is the Next 16 shape. */
  appBuildManifest?: Record<string, unknown> | null;
  documents?: Document[];
};

let workdir: string;

const encodeAssetPath = (assetPath: string) =>
  assetPath.split('/').map(encodeURIComponent).join('/');

const build = (fixture: Fixture) => {
  const nextDir = path.join(workdir, '.next');
  rmSync(nextDir, { recursive: true, force: true });
  mkdirSync(nextDir, { recursive: true });

  for (const [assetPath, size] of Object.entries(fixture.chunks ?? {})) {
    const file = path.join(nextDir, assetPath);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, Buffer.alloc(size, 'x'));
  }

  if (fixture.appBuildManifest) {
    writeFileSync(
      path.join(nextDir, 'app-build-manifest.json'),
      JSON.stringify(fixture.appBuildManifest)
    );
  }

  for (const { route, chunks } of fixture.documents ?? []) {
    const file = path.join(nextDir, 'server', 'app', `${route}.html`);
    mkdirSync(path.dirname(file), { recursive: true });
    const scripts = chunks
      .map((assetPath) => `<script src="/_next/${encodeAssetPath(assetPath)}" async></script>`)
      .join('');
    writeFileSync(file, `<html><body>${scripts}</body></html>`);
  }
};

const run = (fixture: Fixture) => {
  build(fixture);

  try {
    const stdout = execFileSync('node', [SCRIPT], { cwd: workdir, encoding: 'utf8' });
    return { code: 0, output: stdout };
  } catch (error) {
    const failure = error as { status: number; stdout: string; stderr: string };
    return { code: failure.status, output: `${failure.stdout}${failure.stderr}` };
  }
};

const readReport = () =>
  JSON.parse(readFileSync(path.join(workdir, 'artifacts', 'build-route-report.json'), 'utf8')) as {
    source: string;
    routes: { route: string; jsChunkCount: number; totalBytes: number; totalKiB: number }[];
  };

beforeAll(() => {
  workdir = mkdtempSync(path.join(tmpdir(), 'yc-build-report-'));
});

afterAll(() => {
  rmSync(workdir, { recursive: true, force: true });
});

describe('export-build-report', () => {
  it('reads app-build-manifest.json when it is present', () => {
    const result = run({
      chunks: { 'static/chunks/a.js': 2048, 'static/chunks/b.js': 1024 },
      appBuildManifest: {
        pages: {
          '/dashboard/page': ['static/chunks/a.js', 'static/chunks/a.css'],
          '/layout': ['static/chunks/b.js'],
        },
      },
    });

    expect(result.code).toBe(0);
    const report = readReport();
    expect(report.source).toBe('app-build-manifest');
    // `/layout` is not a page, so it is not a route.
    expect(report.routes).toEqual([
      { route: '/dashboard', jsChunkCount: 1, totalBytes: 2048, totalKiB: 2 },
    ]);
  });

  it('falls back to the prerendered documents when app-build-manifest.json is gone', () => {
    // The Next 16 shape. Without the fallback this exits 1 and takes the CI step
    // with it, which is the second half of #3266.
    const result = run({
      chunks: { 'static/chunks/a.js': 2048, 'static/chunks/b.js': 1024 },
      appBuildManifest: null,
      documents: [
        { route: 'index', chunks: ['static/chunks/a.js'] },
        { route: 'settings/profile', chunks: ['static/chunks/a.js', 'static/chunks/b.js'] },
      ],
    });

    expect(result.code).toBe(0);
    const report = readReport();
    expect(report.source).toBe('prerendered-documents');
    expect(report.routes).toEqual([
      { route: '/settings/profile', jsChunkCount: 2, totalBytes: 3072, totalKiB: 3 },
      { route: '/', jsChunkCount: 1, totalBytes: 2048, totalKiB: 2 },
    ]);
  });

  it('falls back when the manifest is present but names no page routes', () => {
    // This is the shape `build-manifest.json` has - `/_app` and `/_error`, no
    // `/page` key anywhere. Repointing the script at it was rejected precisely
    // because the filter yields nothing; treating "no page routes" as "no
    // source" is what keeps that from becoming an empty report.
    const result = run({
      chunks: { 'static/chunks/a.js': 2048 },
      appBuildManifest: { pages: { '/_app': ['static/chunks/a.js'], '/_error': [] } },
      documents: [{ route: 'index', chunks: ['static/chunks/a.js'] }],
    });

    expect(result.code).toBe(0);
    expect(readReport().source).toBe('prerendered-documents');
  });

  it('resolves a chunk referenced through a percent-encoded dynamic segment', () => {
    const assetPath = 'static/chunks/app/docs/[[...slug]]/page-4250dc9.js';
    const result = run({
      chunks: { [assetPath]: 4096 },
      appBuildManifest: null,
      documents: [{ route: 'docs', chunks: [assetPath] }],
    });

    expect(result.code).toBe(0);
    expect(readReport().routes).toEqual([
      { route: '/docs', jsChunkCount: 1, totalBytes: 4096, totalKiB: 4 },
    ]);
  });

  it('counts a chunk referenced twice in one document once', () => {
    const result = run({
      chunks: { 'static/chunks/a.js': 2048 },
      appBuildManifest: null,
      documents: [{ route: 'index', chunks: ['static/chunks/a.js', 'static/chunks/a.js'] }],
    });

    expect(result.code).toBe(0);
    expect(readReport().routes).toEqual([
      { route: '/', jsChunkCount: 1, totalBytes: 2048, totalKiB: 2 },
    ]);
  });

  it('fails loudly when neither source is present', () => {
    const result = run({ chunks: { 'static/chunks/a.js': 2048 }, appBuildManifest: null });

    expect(result.code).toBe(1);
    expect(result.output).toContain('No route source found');
    expect(result.output).toContain('do not repoint this at build-manifest.json');
  });

  describe('keeps every read inside .next', () => {
    // A manifest entry and a `<script src>` are both just strings in a file, and
    // stripping a leading `/` does not stop `..`. Without containment the script
    // resolves clean out of the build directory and reads whatever is there.
    it('refuses a manifest entry that traverses out of the build directory', () => {
      const result = run({
        chunks: { 'static/chunks/a.js': 2048 },
        appBuildManifest: { pages: { '/x/page': ['../../../etc/passwd.js'] } },
      });

      expect(result.code).toBe(1);
      expect(result.output).toContain('which is outside');
      expect(result.output).toContain('../../../etc/passwd.js');
    });

    it('refuses a document script src that traverses out of the build directory', () => {
      const result = run({
        chunks: { 'static/chunks/a.js': 2048 },
        appBuildManifest: null,
        documents: [{ route: 'index', chunks: ['../../../etc/passwd.js'] }],
      });

      expect(result.code).toBe(1);
      expect(result.output).toContain('which is outside');
    });

    it('refuses a sibling directory whose name merely starts with .next', () => {
      // `.nextrogue` passes a bare startsWith(NEXT_DIR) test, so the separator in
      // the guard is what makes it a boundary rather than a prefix. The file is
      // written so that without the guard the script reads it and reports a
      // route, rather than failing on ENOENT for an unrelated reason.
      const rogue = path.join(workdir, '.nextrogue');
      mkdirSync(rogue, { recursive: true });
      writeFileSync(path.join(rogue, 'x.js'), Buffer.alloc(2048, 'x'));

      const result = run({
        chunks: { 'static/chunks/a.js': 2048 },
        appBuildManifest: { pages: { '/x/page': ['../.nextrogue/x.js'] } },
      });

      rmSync(rogue, { recursive: true, force: true });

      expect(result.code).toBe(1);
      expect(result.output).toContain('which is outside');
    });

    it('still accepts a legitimate build-root-relative reference', () => {
      // The guard has to admit the normal shape, or it is just a broken script.
      const result = run({
        chunks: { 'static/chunks/a.js': 2048 },
        appBuildManifest: { pages: { '/x/page': ['/static/chunks/a.js'] } },
      });

      expect(result.code).toBe(0);
      expect(readReport().routes).toEqual([
        { route: '/x', jsChunkCount: 1, totalBytes: 2048, totalKiB: 2 },
      ]);
    });
  });

  it('names the source it used in the markdown report', () => {
    run({
      chunks: { 'static/chunks/a.js': 2048 },
      appBuildManifest: null,
      documents: [{ route: 'index', chunks: ['static/chunks/a.js'] }],
    });

    const markdown = readFileSync(path.join(workdir, 'artifacts', 'build-route-report.md'), 'utf8');
    expect(markdown).toContain('Source: `prerendered-documents` (1 routes)');
  });
});
