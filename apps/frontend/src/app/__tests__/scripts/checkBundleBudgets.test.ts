import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * The budget script decides CI pass/fail for every chunk category, so a change
 * to its thresholds or its classification can silently disable the guardrail -
 * which is exactly what happened in issue #3266, where the old filename rules
 * matched zero files under Turbopack and every ceiling but one stopped guarding
 * anything. These tests build a throwaway `.next` tree - chunks,
 * `build-manifest.json` and prerendered documents - and run the real script
 * against it, because the classification reads all three and only a real
 * directory exercises that.
 *
 * Every category case is run twice, once with webpack-shaped chunk names and
 * once with Turbopack-shaped ones. The names differ; the expected classification
 * does not. That pair is the regression test for #3266.
 */

const SCRIPT = path.resolve(__dirname, '../../../../scripts/check-bundle-budgets.mjs');

// Mirrors the constants in the script. Kept here deliberately: if a threshold
// moves, the just-under and just-over cases below stop straddling it and fail,
// which is the point.
const BUDGETS = {
  page: 290 * 1024,
  async: 1190 * 1024,
  shared: 178 * 1024,
  polyfills: 116 * 1024,
} as const;

// The largest chunk in each category, measured with stat() on a local
// production build of dev at 89eedeaca (next 15.5.24, webpack): 297 chunks over
// 183 prerendered documents. Written as literals rather than derived from
// BUDGETS so each ceiling is pinned to a real build instead of to itself.
const MEASURED_MAXIMA = {
  page: 282_314,
  async: 1_184_191,
  shared: 173_808,
  polyfills: 112_594,
} as const;

type Category = keyof typeof BUDGETS;

// Webpack emits `<name>-<hash>` and `<id>.<hash>`; Turbopack emits a bare
// 13-character content hash with no category in the name at all. The two
// Turbopack names taken from the #3266 measurement are the real ones: the lazy
// chat payload and the chunk on every route's first load.
const WEBPACK_NAMES: Record<Category, string> = {
  polyfills: 'polyfills-42372ed130431b0a.js',
  shared: '4017-959a70755b1f25a1.js',
  page: '9265-2cbb075d9b8d2bb2.js',
  async: '4387.9d0f229b7571893b.js',
};

const TURBOPACK_NAMES: Record<Category, string> = {
  polyfills: 'g7pkq2wlmvnxc.js',
  shared: '2zzbtrhksi9j_.js',
  page: 'x4ntbeuyr93hf.js',
  async: '2o4mqsvixfuw4.js',
};

const BUNDLERS: [string, Record<Category, string>][] = [
  ['webpack', WEBPACK_NAMES],
  ['turbopack', TURBOPACK_NAMES],
];

type Chunk = { name: string; size: number };

type Fixture = {
  /** Chunks written under `.next/static/chunks`. */
  chunks: Chunk[];
  /** Chunk names listed in `build-manifest.json` -> `polyfillFiles`. */
  polyfillFiles?: string[];
  /** Chunk names listed in `build-manifest.json` -> `rootMainFiles`. */
  rootMainFiles?: string[];
  /** Chunk names referenced by a `<script src>` in the prerendered document. */
  firstLoad?: string[];
  /** Replaces the whole manifest object; `null` omits the file entirely. */
  manifest?: Record<string, unknown> | null;
  /** Omits `.next/server` so there is no reachability source at all. */
  omitDocuments?: boolean;
  /** Writes a document with no `/_next/` scripts in it. */
  emptyDocuments?: boolean;
};

let workdir: string;

const toManifestPath = (name: string) => `static/chunks/${name}`;

const build = (fixture: Fixture) => {
  const nextDir = path.join(workdir, '.next');
  rmSync(nextDir, { recursive: true, force: true });
  const chunkDir = path.join(nextDir, 'static', 'chunks');
  mkdirSync(chunkDir, { recursive: true });

  for (const { name, size } of fixture.chunks) {
    const file = path.join(chunkDir, name);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, Buffer.alloc(size, 'x'));
  }

  if (fixture.manifest !== null) {
    writeFileSync(
      path.join(nextDir, 'build-manifest.json'),
      JSON.stringify(
        fixture.manifest ?? {
          polyfillFiles: (fixture.polyfillFiles ?? []).map(toManifestPath),
          rootMainFiles: (fixture.rootMainFiles ?? []).map(toManifestPath),
        }
      )
    );
  }

  if (!fixture.omitDocuments) {
    const documentDir = path.join(nextDir, 'server', 'app');
    mkdirSync(documentDir, { recursive: true });
    const scripts = fixture.emptyDocuments
      ? '<script>window.x=1</script>'
      : (fixture.firstLoad ?? [])
          .map(
            (name) =>
              `<script src="/_next/${toManifestPath(name)
                .split('/')
                .map(encodeURIComponent)
                .join('/')}" async></script>`
          )
          .join('');
    writeFileSync(path.join(documentDir, 'index.html'), `<html><body>${scripts}</body></html>`);
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

/**
 * One chunk in the category under test plus the minimum that keeps the script's
 * own source checks satisfied: `rootMainFiles` is never allowed to be empty and
 * there must always be at least one resolvable first-load reference.
 */
const fixtureFor = (names: Record<Category, string>, category: Category, size: number): Fixture => {
  const anchor = { name: `anchor-${names.shared}`, size: 1024 };
  const subject = { name: names[category], size };

  return {
    chunks: [anchor, subject],
    rootMainFiles: category === 'shared' ? [anchor.name, subject.name] : [anchor.name],
    polyfillFiles: category === 'polyfills' ? [subject.name] : [],
    firstLoad: category === 'page' ? [anchor.name, subject.name] : [anchor.name],
  };
};

beforeAll(() => {
  workdir = mkdtempSync(path.join(tmpdir(), 'yc-budgets-'));
});

afterAll(() => {
  rmSync(workdir, { recursive: true, force: true });
});

describe('check-bundle-budgets', () => {
  describe.each(BUNDLERS)('with %s chunk names', (_bundler, names) => {
    it.each(Object.keys(BUDGETS) as Category[])(
      'passes a %s chunk that is just under budget',
      (category) => {
        const result = run(fixtureFor(names, category, BUDGETS[category] - 1024));

        expect(result.code).toBe(0);
        expect(result.output).toContain('Bundle budget check passed');
      }
    );

    it.each(Object.keys(BUDGETS) as Category[])(
      'fails a %s chunk that is just over budget',
      (category) => {
        const result = run(fixtureFor(names, category, BUDGETS[category] + 1024));

        expect(result.code).toBe(1);
        expect(result.output).toContain('Bundle budget check failed');
        expect(result.output).toContain(names[category]);
        expect(result.output).toContain(`(${category})`);
      }
    );

    it('holds each category to its own budget rather than the largest one', () => {
      // An entry chunk at async size must fail: if the categories ever collapse
      // to one threshold, this is what catches it.
      const result = run(fixtureFor(names, 'shared', BUDGETS.async - 1024));

      expect(result.code).toBe(1);
      expect(result.output).toContain(names.shared);
    });
  });

  it('classifies an unreferenced Turbopack chunk as lazy rather than as a page chunk', () => {
    // This is #3266 itself. `2o4mqsvixfuw4.js` measured 1462.5 KiB in the real
    // Next 16 build and matched none of the old filename rules, so it landed in
    // the 290 KiB page bucket and failed. It is reachable from no document, so
    // it is a lazy payload and the async ceiling is the one that applies.
    const size = BUDGETS.async - 1024;
    const result = run(fixtureFor(TURBOPACK_NAMES, 'async', size));

    expect(size).toBeGreaterThan(BUDGETS.page);
    expect(result.code).toBe(0);
    expect(result.output).toContain('- async: 1 chunks');
  });

  it('counts a first-load chunk reached through a percent-encoded dynamic segment', () => {
    // Dynamic route chunks are referenced as `%5B%5B...slug%5D%5D` in the HTML
    // and stored with literal brackets on disk. Without decoding they resolve to
    // nothing, and the chunk silently becomes lazy - a 4x looser ceiling.
    const name = 'app/(routes)/(public)/docs/[[...slug]]/page-4250dc9ce70b6f2f.js';
    const result = run({
      chunks: [
        { name: WEBPACK_NAMES.shared, size: 1024 },
        { name, size: BUDGETS.page + 1024 },
      ],
      rootMainFiles: [WEBPACK_NAMES.shared],
      firstLoad: [WEBPACK_NAMES.shared, name],
    });

    expect(result.code).toBe(1);
    expect(result.output).toContain('(page)');
    expect(result.output).toContain('[[...slug]]');
  });

  it('treats the framework chunk as a page chunk, because it is not an entry chunk', () => {
    // Documented consequence of classifying from `rootMainFiles` instead of the
    // `framework-` prefix: on dev the 213.9 KiB framework chunk is eager on 1 of
    // 183 documents and is not listed as an entry chunk, so its ceiling is the
    // page one. Pinned here so a future change to that has to be deliberate.
    const result = run({
      chunks: [
        { name: WEBPACK_NAMES.shared, size: 1024 },
        { name: 'framework-e6b407ea27ee0db6.js', size: BUDGETS.shared + 1024 },
      ],
      rootMainFiles: [WEBPACK_NAMES.shared],
      firstLoad: [WEBPACK_NAMES.shared, 'framework-e6b407ea27ee0db6.js'],
    });

    expect(result.code).toBe(0);
    expect(result.output).toContain('- page: 1 chunks');
    expect(result.output).toContain('- shared: 1 chunks');
  });

  it('reports every offender, not just the first', () => {
    const result = run({
      chunks: [
        { name: 'polyfills-a.js', size: BUDGETS.polyfills + 1024 },
        { name: 'entry-b.js', size: BUDGETS.shared + 1024 },
      ],
      polyfillFiles: ['polyfills-a.js'],
      rootMainFiles: ['entry-b.js'],
      firstLoad: ['entry-b.js'],
    });

    expect(result.code).toBe(1);
    expect(result.output).toContain('polyfills-a.js');
    expect(result.output).toContain('entry-b.js');
  });

  it('prints the per-category census on a pass, so a category going empty is visible', () => {
    // The old rules went blind without a single line of output changing. The
    // census is what makes "this ceiling guarded nothing" readable in the CI log
    // rather than something you have to already suspect.
    const result = run({
      chunks: [{ name: 'entry-a.js', size: 1024 }],
      rootMainFiles: ['entry-a.js'],
      firstLoad: ['entry-a.js'],
    });

    expect(result.code).toBe(0);
    expect(result.output).toContain('- shared: 1 chunks');
    expect(result.output).toContain('- page: 0 chunks, largest no chunks');
    expect(result.output).toContain('- async: 0 chunks, largest no chunks');
    expect(result.output).toContain('- polyfills: 0 chunks, largest no chunks');
  });

  describe('fails loudly rather than reclassifying when a source is missing', () => {
    it('fails when there is no build to measure, rather than passing vacuously', () => {
      const result = run({ chunks: [] });

      expect(result.code).not.toBe(0);
      expect(result.output).toContain('No JS bundles found');
    });

    it('fails when build-manifest.json is absent', () => {
      const result = run({
        chunks: [{ name: 'entry-a.js', size: 1024 }],
        manifest: null,
        firstLoad: ['entry-a.js'],
      });

      expect(result.code).toBe(1);
      expect(result.output).toContain('build-manifest.json not found');
    });

    it.each([
      ['polyfillFiles', { rootMainFiles: ['static/chunks/entry-a.js'] }],
      ['rootMainFiles', { polyfillFiles: [] }],
    ])('fails when build-manifest.json has no %s array', (key, manifest) => {
      const result = run({
        chunks: [{ name: 'entry-a.js', size: 1024 }],
        manifest,
        firstLoad: ['entry-a.js'],
      });

      expect(result.code).toBe(1);
      expect(result.output).toContain(`no \`${key}\` array`);
    });

    it('fails when rootMainFiles is present but empty', () => {
      const result = run({
        chunks: [{ name: 'entry-a.js', size: 1024 }],
        manifest: { polyfillFiles: [], rootMainFiles: [] },
        firstLoad: ['entry-a.js'],
      });

      expect(result.code).toBe(1);
      expect(result.output).toContain('lists no `rootMainFiles`');
    });

    it('fails when there are no prerendered documents to read reachability from', () => {
      // Without this the whole build classifies as lazy and the 1190 KiB async
      // ceiling becomes the only one that applies.
      const result = run({
        chunks: [{ name: 'entry-a.js', size: 1024 }],
        rootMainFiles: ['entry-a.js'],
        omitDocuments: true,
      });

      expect(result.code).toBe(1);
      expect(result.output).toContain('No prerendered documents found');
    });

    it('fails when the prerendered documents reference no scripts', () => {
      const result = run({
        chunks: [{ name: 'entry-a.js', size: 1024 }],
        rootMainFiles: ['entry-a.js'],
        emptyDocuments: true,
      });

      expect(result.code).toBe(1);
      expect(result.output).toContain('reference no /_next/ scripts');
    });

    it('fails when a manifest entry does not resolve to a file on disk', () => {
      const result = run({
        chunks: [{ name: 'entry-a.js', size: 1024 }],
        rootMainFiles: ['entry-a.js', 'gone-b.js'],
        firstLoad: ['entry-a.js'],
      });

      expect(result.code).toBe(1);
      expect(result.output).toContain('rootMainFiles` references 1 asset(s) that are not on disk');
    });

    it('fails when a document references a chunk that does not exist', () => {
      const result = run({
        chunks: [{ name: 'entry-a.js', size: 1024 }],
        rootMainFiles: ['entry-a.js'],
        firstLoad: ['entry-a.js', 'gone-b.js'],
      });

      expect(result.code).toBe(1);
      expect(result.output).toContain(
        'the prerendered documents references 1 asset(s) that are not on disk'
      );
    });
  });

  it.each(Object.keys(BUDGETS) as Category[])(
    'keeps the %s ceiling just above the chunk it was ratcheted from',
    (category) => {
      // Both directions matter. Below the measured chunk the gate fails every
      // build; far above it the gate passes everything and warns about nothing,
      // which is the state the budgets were introduced to end.
      expect(BUDGETS[category]).toBeGreaterThan(MEASURED_MAXIMA[category]);
      expect(BUDGETS[category]).toBeLessThan(MEASURED_MAXIMA[category] * 1.1);
    }
  );
});
