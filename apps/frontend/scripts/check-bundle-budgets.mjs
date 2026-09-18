import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const NEXT_DIR = path.resolve('.next');
const NEXT_STATIC_DIR = path.join(NEXT_DIR, 'static');
const NEXT_STATIC_CHUNKS_DIR = path.join(NEXT_STATIC_DIR, 'chunks');
const BUILD_MANIFEST_PATH = path.join(NEXT_DIR, 'build-manifest.json');
const SERVER_DIR = path.join(NEXT_DIR, 'server');

// Chunks are classified from the build's own artefacts, never from their
// filenames. Filename shape is a property of the bundler: the previous rules
// keyed on `framework-`, `main-`, `polyfills-` and `<digits>.<hex>.js`, which
// are webpack conventions. Under Turbopack every one of those patterns matches
// zero files, so every chunk fell through to the `page` bucket and three of the
// four ceilings silently guarded nothing. Measured on the real CI artifacts for
// issue #3266: 3/1/124 chunks in shared/polyfills/async on next 15.5.24, and
// 0/0/0 on 16.3.4 with all 297 in the fallback.
//
// The artefact sources, all of which exist under both bundlers:
//   polyfills - `build-manifest.json` -> `polyfillFiles`
//   shared    - `build-manifest.json` -> `rootMainFiles` (the entry chunks
//               every route loads)
//   page      - referenced by a `<script src>` in a prerendered document under
//               `.next/server`, i.e. on some route's first load
//   async     - reachable from neither: a lazy payload fetched after hydration
//
// There is deliberately no default bucket. If a source is missing, or a
// reference in it does not resolve to a file on disk, the script throws rather
// than reclassifying - a gate that cannot see its input must fail, not guess.
//
// Budgets are ratcheted to roughly 5% above the largest chunk in each category,
// so growth is caught while normal churn is not. They are ceilings, not
// targets. When a change legitimately lands under one, lower the budget to
// match rather than banking the headroom - a budget that sits far above reality
// passes everything and warns about nothing.
//
// The maxima below were measured with this classification on a local
// production build of dev at 89eedeaca (next 15.5.24, webpack): 297 chunks over
// 183 prerendered documents, partitioned 1/4/48/244. Re-deriving them was
// forced rather than optional - moving `shared` from `framework-`/`main-` to
// `rootMainFiles` changes which chunks each ceiling covers, so the previous
// numbers were calibrated against a different partition and carrying them over
// would have been arithmetic on the wrong population.
//
// Every ceiling moves down except `async`, which stays where it was because
// +5% on its measured maximum would be a raise (1214 KiB) and this file's rule
// only lowers. The one chunk whose ceiling loosens is the 213.9 KiB framework
// chunk: it is not an entry chunk in `rootMainFiles` and is eager on 1 of the
// 183 prerendered documents, so it is `page` now (290 KiB) rather than `shared`
// (previously 225 KiB). Every other chunk is guarded at the same ceiling or a
// tighter one.
const PAGE_BUDGET_BYTES = 290 * 1024; // measured max 275.7 KiB (282,314 B)
const ASYNC_BUDGET_BYTES = 1190 * 1024; // measured max 1156.4 KiB (1,184,191 B)
const SHARED_BUDGET_BYTES = 178 * 1024; // measured max 169.7 KiB (173,808 B)
const POLYFILLS_BUDGET_BYTES = 116 * 1024; // measured max 110.0 KiB (112,594 B)

const BUDGETS = {
  page: PAGE_BUDGET_BYTES,
  async: ASYNC_BUDGET_BYTES,
  shared: SHARED_BUDGET_BYTES,
  polyfills: POLYFILLS_BUDGET_BYTES,
};

const formatKiB = (bytes) => `${(bytes / 1024).toFixed(1)} KiB`;

const toPosix = (value) => value.replaceAll(path.sep, '/');

const walk = async (dir, predicate) => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return walk(fullPath, predicate);
      }

      if (!entry.isFile() || !predicate(entry.name)) {
        return [];
      }

      return [fullPath];
    })
  );

  return files.flat();
};

const walkIfPresent = async (dir, predicate) => {
  try {
    return await walk(dir, predicate);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
};

/**
 * Manifest paths are relative to `.next` (`static/chunks/...`). Chunks are
 * reported by absolute path, so both sides are normalised to that form.
 */
const toManifestPath = (absolutePath) => toPosix(path.relative(NEXT_DIR, absolutePath));

const readBuildManifest = async () => {
  let raw;
  try {
    raw = await readFile(BUILD_MANIFEST_PATH, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(
        `${path.relative(process.cwd(), BUILD_MANIFEST_PATH)} not found. It is the only source for the polyfills and shared categories, so the budgets cannot be applied without it. Run a production build first.`
      );
    }

    throw error;
  }

  const manifest = JSON.parse(raw);

  for (const key of ['polyfillFiles', 'rootMainFiles']) {
    if (!Array.isArray(manifest[key])) {
      throw new Error(
        `build-manifest.json has no \`${key}\` array. The budget categories are derived from it, so a missing key would silently empty a category rather than guard it.`
      );
    }
  }

  if (!manifest.rootMainFiles.length) {
    throw new Error(
      'build-manifest.json lists no `rootMainFiles`. Every Next build has entry chunks, so an empty list means the manifest shape changed and the shared ceiling would guard nothing.'
    );
  }

  return manifest;
};

const SCRIPT_SRC_PATTERN = /<script[^>]*\ssrc="([^"]+)"/gi;

/**
 * First-load chunks are the ones a prerendered document actually asks for. The
 * `<script src>` set is the only like-for-like instrument that survives the
 * bundler change, because it is emitted by the renderer rather than by the
 * bundler's naming scheme.
 */
const readFirstLoadChunks = async () => {
  const documents = await walkIfPresent(SERVER_DIR, (name) => name.endsWith('.html'));
  if (!documents?.length) {
    throw new Error(
      `No prerendered documents found under ${path.relative(process.cwd(), SERVER_DIR)}. First-load chunks are read from their <script src> tags, so without them every chunk would be misclassified as lazy.`
    );
  }

  const chunks = new Set();
  for (const document of documents) {
    const html = await readFile(document, 'utf8');
    for (const [, src] of html.matchAll(SCRIPT_SRC_PATTERN)) {
      const [, assetPath] = src.split('/_next/');
      if (assetPath) {
        // Dynamic segments reach the HTML percent-encoded (`%5B%5B...slug%5D%5D`)
        // while the file on disk keeps its literal brackets.
        chunks.add(decodeURIComponent(assetPath));
      }
    }
  }

  if (!chunks.size) {
    throw new Error(
      `${documents.length} prerendered documents reference no /_next/ scripts. The first-load set would be empty, which is a broken instrument rather than a lean build.`
    );
  }

  return { chunks, documentCount: documents.length };
};

const assertResolvable = (label, manifestPaths, known) => {
  const missing = manifestPaths.filter((manifestPath) => !known.has(manifestPath));
  if (missing.length) {
    throw new Error(
      `${label} references ${missing.length} asset(s) that are not on disk under .next, starting with ${missing[0]}. The reference shape has changed, so the classification cannot be trusted.`
    );
  }
};

const main = async () => {
  const jsFiles = await walk(NEXT_STATIC_CHUNKS_DIR, (name) => name.endsWith('.js'));
  if (!jsFiles.length) {
    throw new Error(
      `No JS bundles found in ${NEXT_STATIC_CHUNKS_DIR}. Run a production build first.`
    );
  }

  const manifest = await readBuildManifest();
  const { chunks: firstLoadChunks, documentCount } = await readFirstLoadChunks();

  // Resolvability is checked against every JS asset Next emitted, not just the
  // chunks the budgets cover: the prerendered documents also reference
  // `static/<buildId>/_buildManifest.js` and friends, which are real files that
  // simply live outside `static/chunks`.
  const knownAssets = new Set(
    (await walk(NEXT_STATIC_DIR, (name) => name.endsWith('.js'))).map(toManifestPath)
  );
  assertResolvable('build-manifest.json `polyfillFiles`', manifest.polyfillFiles, knownAssets);
  assertResolvable('build-manifest.json `rootMainFiles`', manifest.rootMainFiles, knownAssets);
  assertResolvable(
    'the prerendered documents',
    [...firstLoadChunks].filter((asset) => asset.endsWith('.js')),
    knownAssets
  );

  const polyfills = new Set(manifest.polyfillFiles);
  const entries = new Set(manifest.rootMainFiles);

  const categorise = (manifestPath) => {
    if (polyfills.has(manifestPath)) {
      return 'polyfills';
    }

    if (entries.has(manifestPath)) {
      return 'shared';
    }

    return firstLoadChunks.has(manifestPath) ? 'page' : 'async';
  };

  const failures = [];
  const checked = [];

  for (const filePath of jsFiles) {
    const size = (await stat(filePath)).size;
    const category = categorise(toManifestPath(filePath));
    const budget = BUDGETS[category];

    checked.push({ filePath, size, budget, category });

    if (size > budget) {
      failures.push({ filePath, size, budget, category });
    }
  }

  // Printed on pass as well as on fail: the previous rules went blind without
  // any output changing, and a per-category census is what makes that visible.
  console.log(
    `Classified ${checked.length} JS assets from build-manifest.json and ${documentCount} prerendered documents:`
  );
  for (const category of Object.keys(BUDGETS)) {
    const inCategory = checked.filter((asset) => asset.category === category);
    const largest = inCategory.length
      ? formatKiB(inCategory.reduce((max, asset) => Math.max(max, asset.size), 0))
      : 'no chunks, so this ceiling guarded nothing';
    console.log(
      `- ${category}: ${inCategory.length} chunks, largest ${largest}, budget ${formatKiB(BUDGETS[category])}`
    );
  }

  if (failures.length) {
    console.error('Bundle budget check failed:');
    for (const failure of failures) {
      console.error(
        `- ${path.relative(process.cwd(), failure.filePath)} (${failure.category}): ${formatKiB(failure.size)} > ${formatKiB(failure.budget)}`
      );
    }
    process.exit(1);
  }

  console.log(`Bundle budget check passed for ${checked.length} JS assets.`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
