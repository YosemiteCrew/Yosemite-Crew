import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const NEXT_DIR = path.resolve('.next');
const APP_BUILD_MANIFEST_PATH = path.join(NEXT_DIR, 'app-build-manifest.json');
const SERVER_APP_DIR = path.join(NEXT_DIR, 'server', 'app');
const OUTPUT_DIR = path.resolve('artifacts');
const OUTPUT_JSON_PATH = path.join(OUTPUT_DIR, 'build-route-report.json');
const OUTPUT_MARKDOWN_PATH = path.join(OUTPUT_DIR, 'build-route-report.md');

// Two sources, because `app-build-manifest.json` is a webpack-era artefact that
// Next 16 removed (issue #3266). The fallback is the prerendered documents,
// whose `<script src>` tags are emitted by the renderer rather than the bundler
// and so survive the change.
//
// Repointing at `build-manifest.json` is NOT a third option: its `pages` keys
// are pages-router only (`/_app`, `/_error`), none of which ends in `/page`, so
// the filter yields nothing and the script writes an empty report and exits 0 -
// a loud failure replaced by a silent one. When neither source is present this
// script throws instead, and the source it did use is recorded in the report.
const SOURCE_APP_BUILD_MANIFEST = 'app-build-manifest';
const SOURCE_PRERENDERED_DOCUMENTS = 'prerendered-documents';

const normalizeRoute = (route) => route.replace(/^app\//, '/').replace(/\/page$/, '') || '/';

const formatKiB = (bytes) => `${(bytes / 1024).toFixed(1)} KiB`;

/**
 * Every path this script reads is resolved and then required to be inside
 * `.next`. Containment at the read is the same instinct as refusing to guess
 * when a source is missing: this script does not trust what produced its input.
 */
const insideNext = (candidate, resolved) => {
  if (resolved !== NEXT_DIR && !resolved.startsWith(`${NEXT_DIR}${path.sep}`)) {
    throw new Error(`${candidate} resolves to ${resolved}, which is outside ${NEXT_DIR}.`);
  }

  return resolved;
};

/**
 * Asset references come out of a manifest entry or a `<script src>`, where a
 * leading `/` means "the build root" rather than the filesystem root. Stripping
 * it does not stop `..` - a segment like `../../etc/passwd` resolves clean out
 * of the build directory, which is what the containment check is for.
 */
const resolveAssetInsideNext = (assetPath) => {
  const normalized = assetPath.startsWith('/') ? assetPath.slice(1) : assetPath;
  return insideNext(assetPath, path.resolve(NEXT_DIR, normalized));
};

/** For paths this script produced itself, which must still land inside `.next`. */
const resolveInsideNext = (filePath) => insideNext(filePath, path.resolve(filePath));

const sumChunkSizes = async (chunkPaths) => {
  const sizes = await Promise.all(
    chunkPaths.map(async (chunkPath) => {
      const contents = await readFile(resolveAssetInsideNext(chunkPath));
      return contents.byteLength;
    })
  );

  return sizes.reduce((total, size) => total + size, 0);
};

const readJsonIfPresent = async (filePath) => {
  try {
    return JSON.parse(await readFile(resolveInsideNext(filePath), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
};

const walkHtml = async (dir) => {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }

    throw error;
  }

  const found = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return walkHtml(fullPath);
      }

      return entry.isFile() && entry.name.endsWith('.html') ? [fullPath] : [];
    })
  );

  return found.flat();
};

const fromAppBuildManifest = async () => {
  const manifest = await readJsonIfPresent(APP_BUILD_MANIFEST_PATH);
  if (!manifest) {
    return null;
  }

  const entries = Object.entries(manifest.pages ?? {}).filter(([route]) => route.endsWith('/page'));
  if (!entries.length) {
    return null;
  }

  const routes = await Promise.all(
    entries.map(async ([route, chunks]) => {
      const jsChunks = chunks.filter((chunkPath) => chunkPath.endsWith('.js'));
      return {
        route: normalizeRoute(route),
        jsChunkCount: jsChunks.length,
        totalBytes: await sumChunkSizes(jsChunks),
      };
    })
  );

  return { source: SOURCE_APP_BUILD_MANIFEST, routes };
};

const SCRIPT_SRC_PATTERN = /<script[^>]*\ssrc="([^"]+)"/gi;

/**
 * Dynamic segments reach the HTML percent-encoded (`%5B%5B...slug%5D%5D`) while
 * the file on disk keeps its literal brackets, so the src has to be decoded
 * before it can be read as a path.
 */
const toAssetPath = (src) => {
  const [, assetPath] = src.split('/_next/');
  return assetPath ? decodeURIComponent(assetPath) : undefined;
};

const routeFromDocument = (documentPath) => {
  const relative = path.relative(SERVER_APP_DIR, documentPath).replaceAll(path.sep, '/');
  const withoutExtension = relative.slice(0, -'.html'.length).replace(/(^|\/)index$/, '');
  return normalizeRoute(withoutExtension ? `/${withoutExtension}` : '');
};

const fromPrerenderedDocuments = async () => {
  const documents = await walkHtml(SERVER_APP_DIR);
  if (!documents.length) {
    return null;
  }

  const routes = await Promise.all(
    documents.map(async (documentPath) => {
      const html = await readFile(resolveInsideNext(documentPath), 'utf8');
      const jsChunks = [...html.matchAll(SCRIPT_SRC_PATTERN)]
        .map(([, src]) => toAssetPath(src))
        .filter((assetPath) => assetPath?.endsWith('.js'));
      const unique = [...new Set(jsChunks)];

      return {
        route: routeFromDocument(documentPath),
        jsChunkCount: unique.length,
        totalBytes: await sumChunkSizes(unique),
      };
    })
  );

  return { source: SOURCE_PRERENDERED_DOCUMENTS, routes };
};

const main = async () => {
  const report = (await fromAppBuildManifest()) ?? (await fromPrerenderedDocuments());
  if (!report) {
    throw new Error(
      `No route source found. Looked for ${path.relative(process.cwd(), APP_BUILD_MANIFEST_PATH)} (removed in Next 16) and prerendered documents under ${path.relative(process.cwd(), SERVER_APP_DIR)}. Run a production build first; do not repoint this at build-manifest.json, which is pages-router only and would report zero routes as a success.`
    );
  }

  const sortedRoutes = report.routes
    .map((route) => ({ ...route, totalKiB: Number((route.totalBytes / 1024).toFixed(1)) }))
    .sort((left, right) => right.totalBytes - left.totalBytes);

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(
    OUTPUT_JSON_PATH,
    JSON.stringify(
      { generatedAt: new Date().toISOString(), source: report.source, routes: sortedRoutes },
      null,
      2
    )
  );

  const markdownLines = [
    '# Frontend Build Route Report',
    '',
    `Source: \`${report.source}\` (${sortedRoutes.length} routes)`,
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
    `Wrote route build reports for ${sortedRoutes.length} routes from ${report.source} to ${path.relative(process.cwd(), OUTPUT_DIR)}`
  );
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
