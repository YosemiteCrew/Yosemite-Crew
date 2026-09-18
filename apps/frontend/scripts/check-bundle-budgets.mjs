import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = process.env.NEXT_BUILD_DIR
  ? path.resolve(process.env.NEXT_BUILD_DIR)
  : path.resolve(__dirname, '..', '..');
const NEXT_STATIC_CHUNKS_DIR = path.resolve(PROJECT_ROOT, '.next/static/chunks');
const BUILD_MANIFEST_PATH = path.resolve(PROJECT_ROOT, '.next/build-manifest.json');
const SERVER_DIR = path.resolve(PROJECT_ROOT, '.next/server');

// Budgets are ratcheted to roughly 5% above the largest chunk in each category
// at the time of writing, so growth is caught while normal churn is not. The
// measured maxima were: page 355.5 KiB, async 1134.4 KiB, shared 185.3 KiB
// (framework), polyfills 110.0 KiB.
//
// These are ceilings, not targets. When a change legitimately lands under one,
// lower the budget to match rather than banking the headroom - a budget that
// sits far above reality passes everything and warns about nothing, which is
// what these did before.
const JS_BUDGET_BYTES = 375 * 1024;
const LARGE_ASYNC_CHUNK_BUDGET_BYTES = 1190 * 1024;
const SHARED_CHUNK_BUDGET_BYTES = 195 * 1024;
const POLYFILLS_BUDGET_BYTES = 120 * 1024;

const formatKiB = (bytes) => `${(bytes / 1024).toFixed(1)} KiB`;

const walk = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return walk(fullPath);
      }

      if (!entry.isFile() || !entry.name.endsWith('.js')) {
        return [];
      }

      return [fullPath];
    })
  );

  return files.flat();
};

const loadBuildManifest = async () => {
  try {
    const content = await readFile(BUILD_MANIFEST_PATH, 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
};

const collectFirstLoadChunks = async () => {
  const firstLoadChunks = new Set();

  const walkServer = async (dir) => {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walkServer(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.html')) {
        const html = await readFile(fullPath, 'utf8');
        const scriptMatches = html.match(/<script\s+src="([^"]+\.js)"/g);
        if (scriptMatches) {
          for (const match of scriptMatches) {
            const srcMatch = match.match(/src="([^"]+)"/);
            if (srcMatch) {
              const chunkPath = srcMatch[1].startsWith('/') ? srcMatch[1].slice(1) : srcMatch[1];
              const normalizedChunkPath = chunkPath.startsWith('_next/')
                ? chunkPath.slice('_next/'.length)
                : chunkPath;
              firstLoadChunks.add(normalizedChunkPath);
            }
          }
        }
      }
    }
  };

  await walkServer(SERVER_DIR);
  return firstLoadChunks;
};

const buildChunkClassifier = async () => {
  const buildManifest = await loadBuildManifest();
  const firstLoadChunks = await collectFirstLoadChunks();

  const polyfillFiles = new Set(buildManifest?.polyfillFiles ?? []);
  const rootMainFiles = new Set(buildManifest?.rootMainFiles ?? []);

  const useArtifactClassification = buildManifest || firstLoadChunks.size > 0;

  if (!useArtifactClassification) {
    // Fallback to legacy filename-based classification for backward compatibility
    return (filePath) => {
      const normalized = filePath.replaceAll(path.sep, '/');
      if (normalized.includes('/chunks/framework-') || normalized.includes('/chunks/main-')) {
        return 'shared';
      }
      if (normalized.includes('/chunks/polyfills-')) {
        return 'polyfills';
      }
      if (/\/chunks\/\d+\.[a-f0-9]+\.js$/i.test(normalized)) {
        return 'async';
      }
      return 'page';
    };
  }

  return (filePath) => {
    const normalized = filePath.replaceAll(path.sep, '/');

    const relativeToNext = normalized.includes('/.next/')
      ? normalized.split('/.next/')[1]
      : normalized;

    if (polyfillFiles.has(relativeToNext)) {
      return 'polyfills';
    }

    if (rootMainFiles.has(relativeToNext)) {
      return 'shared';
    }

    if (firstLoadChunks.has(relativeToNext)) {
      return 'page';
    }

    return 'async';
  };
};

const main = async () => {
  const jsFiles = await walk(NEXT_STATIC_CHUNKS_DIR);
  if (!jsFiles.length) {
    throw new Error(
      `No JS bundles found in ${NEXT_STATIC_CHUNKS_DIR}. Run a production build first.`
    );
  }

  const classify = await buildChunkClassifier();

  const failures = [];
  const checked = [];

  for (const filePath of jsFiles) {
    const size = (await stat(filePath)).size;
    const category = classify(filePath);
    const budget =
      category === 'shared'
        ? SHARED_CHUNK_BUDGET_BYTES
        : category === 'polyfills'
          ? POLYFILLS_BUDGET_BYTES
          : category === 'async'
            ? LARGE_ASYNC_CHUNK_BUDGET_BYTES
            : JS_BUDGET_BYTES;

    checked.push({ filePath, size, budget, category });

    if (size > budget) {
      failures.push({ filePath, size, budget, category });
    }
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
