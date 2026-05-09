import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const NEXT_STATIC_CHUNKS_DIR = path.resolve('.next/static/chunks');
const JS_BUDGET_BYTES = 400 * 1024;
const LARGE_ASYNC_CHUNK_BUDGET_BYTES = 1200 * 1024;
const SHARED_CHUNK_BUDGET_BYTES = 220 * 1024;
const POLYFILLS_BUDGET_BYTES = 150 * 1024;

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

  const failures = [];
  const checked = [];

  for (const filePath of jsFiles) {
    const size = (await stat(filePath)).size;
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
