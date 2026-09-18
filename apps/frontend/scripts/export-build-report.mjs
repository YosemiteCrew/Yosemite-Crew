import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const findNextDir = () => {
  if (process.env.NEXT_BUILD_DIR) {
    return path.resolve(process.env.NEXT_BUILD_DIR);
  }
  const cwd = process.cwd();
  return path.resolve(cwd, '.next');
};
const PROJECT_ROOT = findNextDir();
const BUILD_MANIFEST_PATH = path.resolve(PROJECT_ROOT, 'build-manifest.json');
const APP_BUILD_MANIFEST_PATH = path.resolve(PROJECT_ROOT, 'app-build-manifest.json');
const OUTPUT_DIR = path.resolve(PROJECT_ROOT, 'artifacts');
const OUTPUT_JSON_PATH = path.join(OUTPUT_DIR, 'build-route-report.json');
const OUTPUT_MARKDOWN_PATH = path.join(OUTPUT_DIR, 'build-route-report.md');

const normalizeRoute = (route) => route.replace(/^app\//, '/').replace(/\/page$/, '') || '/';

const sumChunkSizes = async (chunkPaths) => {
  const sizes = await Promise.all(
    chunkPaths.map(async (chunkPath) => {
      const normalizedPath = chunkPath.startsWith('/') ? chunkPath.slice(1) : chunkPath;
      const filePath = path.resolve(PROJECT_ROOT, normalizedPath);
      const contents = await readFile(filePath);
      return contents.byteLength;
    })
  );

  return sizes.reduce((total, size) => total + size, 0);
};

const formatKiB = (bytes) => `${(bytes / 1024).toFixed(1)} KiB`;

const loadManifest = async () => {
  try {
    const content = await readFile(BUILD_MANIFEST_PATH, 'utf8');
    const manifest = JSON.parse(content);
    return { manifest, source: 'build-manifest.json' };
  } catch {
    try {
      const content = await readFile(APP_BUILD_MANIFEST_PATH, 'utf8');
      const manifest = JSON.parse(content);
      return { manifest, source: 'app-build-manifest.json' };
    } catch {
      return null;
    }
  }
};

const main = async () => {
  const loaded = await loadManifest();
  if (!loaded) {
    throw new Error(
      'Cannot generate route build report: neither build-manifest.json nor app-build-manifest.json found. ' +
        'Run a production build first. Next 16+ (Turbopack) uses build-manifest.json; Next 15 and earlier use app-build-manifest.json.'
    );
  }

  const { manifest, source } = loaded;
  const pages = manifest.pages ?? {};

  const routes = await Promise.all(
    Object.entries(pages)
      .filter(([route]) => route.endsWith('/page'))
      .map(async ([route, chunks]) => {
        const jsChunks = chunks.filter((chunkPath) => chunkPath.endsWith('.js'));
        const totalBytes = await sumChunkSizes(jsChunks);
        return {
          route: normalizeRoute(route),
          jsChunkCount: jsChunks.length,
          totalBytes,
          totalKiB: Number((totalBytes / 1024).toFixed(1)),
        };
      })
  );

  const sortedRoutes = routes.sort((left, right) => right.totalBytes - left.totalBytes);
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(
    OUTPUT_JSON_PATH,
    JSON.stringify({ generatedAt: new Date().toISOString(), source, routes: sortedRoutes }, null, 2)
  );

  const markdownLines = [
    '# Frontend Build Route Report',
    '',
    `Source: ${source}`,
    '',
    '| Route | JS chunks | Total JS |',
    '| --- | ---: | ---: |',
    ...sortedRoutes.map(
      (route) => `| \`${route.route}\` | ${route.jsChunkCount} | ${formatKiB(route.totalBytes)} |`
    ),
    '',
  ];
  await writeFile(OUTPUT_MARKDOWN_PATH, markdownLines.join('\n'));

  console.log(
    `Wrote route build reports to ${path.relative(process.cwd(), OUTPUT_DIR)} (source: ${source})`
  );
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
