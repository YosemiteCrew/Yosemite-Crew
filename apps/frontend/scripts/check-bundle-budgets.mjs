import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const NEXT_STATIC_CHUNKS_DIR = path.resolve('.next/static/chunks');
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

const getChunkCategory = (filePath) => {
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

const main = async () => {
  const jsFiles = await walk(NEXT_STATIC_CHUNKS_DIR);
  if (!jsFiles.length) {
    throw new Error(
      `No JS bundles found in ${NEXT_STATIC_CHUNKS_DIR}. Run a production build first.`
    );
  }

  const sizes = await Promise.all(jsFiles.map(async (filePath) => (await stat(filePath)).size));
  const failures = [];
  const checked = [];

  for (const [index, filePath] of jsFiles.entries()) {
    const size = sizes[index];
    const category = getChunkCategory(filePath);
    const budget =
      category === 'shared'
        ? SHARED_CHUNK_BUDGET_BYTES
        : category === 'polyfills'
          ? POLYFILLS_BUDGET_BYTES
          : category === 'async'
            ? LARGE_ASYNC_CHUNK_BUDGET_BYTES
            : JS_BUDGET_BYTES;

    checked.push({ filePath, size, budget });

    if (size > budget) {
      failures.push({ filePath, size, budget });
    }
  }

  if (failures.length) {
    console.error('Bundle budget check failed:');
    for (const failure of failures) {
      console.error(
        `- ${path.relative(process.cwd(), failure.filePath)}: ${formatKiB(failure.size)} > ${formatKiB(failure.budget)}`
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
