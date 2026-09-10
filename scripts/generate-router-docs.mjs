#!/usr/bin/env node
/**
 * Generate router API doc pages from *.router.ts source files.
 * Usage: node scripts/generate-router-docs.mjs
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const ROUTERS_DIR = 'apps/backend/src/routers';
const DOCS_DIR = 'apps/frontend/content/docs/apps/backend/routers';
const INDEX_FILE = 'apps/frontend/content/docs/apps/backend/index.md';

function extractBlock(src, startIndex) {
  let depth = 1;
  let i = startIndex;
  while (i < src.length && depth > 0) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')') depth--;
    i++;
  }
  return src.substring(startIndex, i);
}

function extractRouteInfo(block, globalAuth) {
  let auth = block.includes('requireWebAuth')
    ? 'requireWebAuth'
    : block.includes('requireMobileAuth')
      ? 'requireMobileAuth'
      : block.includes('attachSessionIfPresent')
        ? 'attachSessionIfPresent (optional)'
        : block.includes('requireAnyAuth')
          ? 'requireAnyAuth'
          : block.includes('authorizeApiKey')
            ? 'authorizeApiKey'
            : block.includes('requireAuth')
              ? 'requireAuth'
              : (globalAuth ?? 'public');

  let permission = null;
  const permMatch = block.match(/requirePermission\(["'`]([^"'`]+)["'`]\)/);
  if (permMatch) permission = permMatch[1];

  let controller = 'inline handler';
  const controllerMatch = block.match(/(\w+Controller)\.\w+/);
  if (controllerMatch) controller = controllerMatch[1];

  let rateLimit = null;
  if (block.includes('rateLimit') || block.includes('Limiter')) {
    rateLimit = 'rate-limited';
  }

  return { auth, controller, permission, rateLimit };
}

function resolveTemplateLiteral(src, template) {
  const constRegex = /(?:const|let|var)\s+(\w+)\s*=\s*(?:["']([^"']+)["']|`(.*?)`)/gs;
  const constMap = {};
  for (const m of src.matchAll(constRegex)) {
    constMap[m[1]] = m[2] ?? m[3];
  }
  let resolved = template;
  for (let i = 0; i < 10; i++) {
    const refMatch = resolved.match(/\$\{(\w+)\}/);
    if (!refMatch) break;
    const val = constMap[refMatch[1]];
    if (val === undefined) break;
    resolved = resolved.replace(`\${${refMatch[1]}}`, val);
  }
  return resolved;
}

function resolvePath(src, path) {
  if (!path) return '/';
  if (path.includes('${')) return resolveTemplateLiteral(src, path);
  if (!path.includes('/') && path !== '') {
    const constRegex = new RegExp(
      '(?:const|let|var)\\s+' +
        path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
        '\\s*=\\s*["\']([^"\']+)["\']'
    );
    const constMatch = src.match(constRegex);
    if (constMatch) path = constMatch[1];
  }
  return path;
}

function parseRouterFile(filePath) {
  const src = readFileSync(filePath, 'utf8');
  const routes = [];

  // router.use(...) applies auth to every route in the file.
  const useBlocks = [...src.matchAll(/\.use\(\s*([\s\S]*?)\)\s*;/g)];
  let globalAuth = null;
  for (const um of useBlocks) {
    const blk = um[1];
    const mws =
      blk.match(
        /require(?:Web|Mobile|Any)?Auth|requireSuperAdmin|authorizeApiKey|attachSessionIfPresent/g
      ) || [];
    if (mws.length) {
      globalAuth = mws.includes('requireSuperAdmin') ? `${mws.join(', ')}` : mws.join(', ');
      break;
    }
  }

  // Pattern 1: router.METHOD("path", ...) — direct calls
  const directRegex = /(\w+)\.(get|post|put|patch|delete)\(\s*\n?\s*(?:"([^"]*)"|`([^`]*)`|(\w+))/g;
  let match;
  while ((match = directRegex.exec(src)) !== null) {
    const method = match[2].toUpperCase();
    let path = match[3] !== undefined ? match[3] : match[4] !== undefined ? match[4] : match[5];
    if (path === null || path === undefined) continue;
    path = resolvePath(src, path);

    const block = extractBlock(src, match.index + match[0].length);
    routes.push({ method, path, ...extractRouteInfo(block, globalAuth) });
  }

  // Pattern 2: router.route("path").METHOD(...) — chained pattern (may span lines)
  const routeChainedRegex = /(\w+)\s*\n?\s*\.route\(\s*(?:"([^"]+)"|`([^`]+)`|(\w+))\s*\)/g;
  let routeMatch;
  while ((routeMatch = routeChainedRegex.exec(src)) !== null) {
    let basePath =
      routeMatch[2] !== undefined
        ? routeMatch[2]
        : routeMatch[3] !== undefined
          ? routeMatch[3]
          : routeMatch[4];
    if (basePath === null || basePath === undefined) continue;
    basePath = resolvePath(src, basePath);

    // Find the chain start (after .route("..."))
    const chainStart = routeMatch.index + routeMatch[0].length;

    // Bound the chain window: methods belong to this chain only until the
    // next `.route(` statement begins or the source ends.
    const nextRouteIdx = src.indexOf('.route(', chainStart + 1);
    const windowEnd = nextRouteIdx === -1 ? src.length : nextRouteIdx;
    const chainRest = src.substring(chainStart, windowEnd);
    // Chained methods come after a `)` (the previous call close); direct
    // `router.post(` has a word char before the dot and must not be treated
    // as part of this chain.
    const methodChainRegex = /(?<!\w)\.\s*\n?\s*(get|post|put|patch|delete)\s*\(/g;
    let methodMatch;
    while ((methodMatch = methodChainRegex.exec(chainRest)) !== null) {
      const method = methodMatch[1].toUpperCase();
      const blockStart = chainStart + methodMatch.index + methodMatch[0].length;
      const block = extractBlock(src, blockStart);
      routes.push({ method, path: basePath, ...extractRouteInfo(block, globalAuth) });
    }
  }

  return routes;
}

function generateDocPage(routerName, routes) {
  // Convert kebab/dot/camel router name to title case: "clinical-artifact.fhir"
  // -> "Clinical Artifact (Fhir)", "authUserMobile" -> "AuthUserMobile".
  const rawName = routerName.replace(/\.router$/, '');
  let title = rawName
    .split(/[-.]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  const slug = routerName.replace(/\.router$/, '');
  const id = `backend-api-${slug.replace(/[^a-zA-Z0-9-]/g, '-')}`;

  const lines = [];
  lines.push('---');
  lines.push(`id: ${id}`);
  lines.push(`title: ${title} API`);
  lines.push(`slug: /apps/backend/api/${slug}`);
  lines.push('---');
  lines.push('');

  const hasMobile = routes.some((r) => r.path.includes('/mobile/'));
  const hasPms = routes.some((r) => r.path.includes('/pms/'));
  const hasApp = routes.some((r) => /^\/app[\s/]/.test(r.path));

  if (hasMobile && hasPms) {
    lines.push(
      'Routes under `/mobile` are called by the mobile app on behalf of a pet parent; routes under `/pms` are called by the PIMS (Practice Information Management System, the clinic-facing web app) and require organisation RBAC (role-based access control) permissions.'
    );
  } else if (hasMobile) {
    lines.push('Mobile routes are called by the mobile app on behalf of a pet parent.');
  } else if (hasPms) {
    lines.push(
      'PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.'
    );
  } else if (hasApp) {
    lines.push('App routes serve the public-facing application.');
  } else {
    lines.push(`API routes for the ${title.toLowerCase()} feature.`);
  }

  lines.push('');
  lines.push('**Endpoints**');

  const grouped = {};
  for (const r of routes) {
    const key = r.path.startsWith('/') ? r.path : `/${r.path}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  }

  for (const [fullPath, group] of Object.entries(grouped)) {
    for (const r of group) {
      lines.push('');
      lines.push(`### ${r.method} ${fullPath}`);
      lines.push(`- Auth: \`${r.auth}\``);
      if (r.permission) {
        lines.push(`- Permission: \`${r.permission}\``);
      }
      if (r.rateLimit) {
        lines.push(`- Rate limit: ${r.rateLimit}`);
      }
      lines.push(`- Controller: \`${r.controller}\``);
    }
  }

  lines.push('');
  return lines.join('\n');
}

// Main
const routerDir = join(process.cwd(), ROUTERS_DIR);
const docsDir = join(process.cwd(), DOCS_DIR);
const files = readdirSync(routerDir).filter(
  (f) => f.endsWith('.router.ts') || f.endsWith('.routes.ts')
);

const indexEntries = [];

for (const file of files) {
  // observationTool.routes.ts -> observationTool, mobile.config.router.ts -> mobile.config
  const routerName = file.replace(/\.(router|routes)\.ts$/, '');
  const routerPath = join(routerDir, file);
  const routes = parseRouterFile(routerPath);

  if (routes.length === 0) {
    console.warn(`⚠ No routes found in ${file}`);
    continue;
  }

  const doc = generateDocPage(routerName, routes);
  const docFile = join(docsDir, `${routerName}.md`);
  if (existsSync(docFile)) {
    console.log(`↷ kept existing ${routerName}.md (hand-maintained)`);
  } else {
    writeFileSync(docFile, doc);
    console.log(`✓ ${routerName}.md (${routes.length} routes)`);
  }

  const title = routerName
    .replace(/\.router$/, '')
    .split(/[-.]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  const slug = routerName.replace(/\.router$/, '');
  indexEntries.push({ title, slug, routeCount: routes.length });
}

// Sort index entries alphabetically by title
indexEntries.sort((a, b) => a.title.localeCompare(b.title));

// Update index.md
const indexLines = [
  '---',
  'id: backend-index',
  'title: Backend API Index',
  'slug: /apps/backend/api',
  '---',
  '',
  'This index lists the Yosemite Crew backend REST API, split by router (one page per feature area). Base paths reflect the registration in `apps/backend/src/routers/index.ts`. For how the server itself boots and models data, see the [Backend App README](/apps/backend).',
  '',
  '> Router pages are generated from current router source by `scripts/generate-router-docs.mjs` (`node scripts/generate-router-docs.mjs`). Regenerate after adding or changing routers. A few hand-maintained pages with extra request/response detail are left untouched by the generator.',
  '',
  `**Routers** (${indexEntries.length} pages)`,
  '',
  ...indexEntries.map(
    (e) => `- [${e.title} API](/apps/backend/api/${e.slug}) (${e.routeCount} endpoints)`
  ),
  '',
];

writeFileSync(join(process.cwd(), INDEX_FILE), indexLines.join('\n'));
console.log(`\n✓ index.md updated with ${indexEntries.length} routers`);
