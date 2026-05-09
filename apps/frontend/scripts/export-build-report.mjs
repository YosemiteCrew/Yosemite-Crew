import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const MANIFEST_PATH = path.resolve('.next/app-build-manifest.json');
const OUTPUT_DIR = path.resolve('artifacts');
const OUTPUT_JSON_PATH = path.join(OUTPUT_DIR, 'build-route-report.json');
const OUTPUT_MARKDOWN_PATH = path.join(OUTPUT_DIR, 'build-route-report.md');

const normalizeRoute = (route) => route.replace(/^app\//, '/').replace(/\/page$/, '') || '/';

const sumChunkSizes = async (chunkPaths) => {
  const sizes = await Promise.all(
    chunkPaths.map(async (chunkPath) => {
      const normalizedPath = chunkPath.startsWith('/') ? chunkPath.slice(1) : chunkPath;
      const filePath = path.resolve('.next', normalizedPath);
      const contents = await readFile(filePath);
      return contents.byteLength;
    })
  );

  return sizes.reduce((total, size) => total + size, 0);
};

const formatKiB = (bytes) => `${(bytes / 1024).toFixed(1)} KiB`;

const main = async () => {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
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
    JSON.stringify({ generatedAt: new Date().toISOString(), routes: sortedRoutes }, null, 2)
  );

  const markdownLines = [
    '# Frontend Build Route Report',
    '',
    '| Route | JS chunks | Total JS |',
    '| --- | ---: | ---: |',
    ...sortedRoutes.map(
      (route) => `| \`${route.route}\` | ${route.jsChunkCount} | ${formatKiB(route.totalBytes)} |`
    ),
    '',
  ];
  await writeFile(OUTPUT_MARKDOWN_PATH, markdownLines.join('\n'));

  console.log(`Wrote route build reports to ${path.relative(process.cwd(), OUTPUT_DIR)}`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
