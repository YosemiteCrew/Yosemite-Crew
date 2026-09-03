#!/usr/bin/env node
/**
 * One-off repair: adds the `x-org-id` header parameter to every organisation-
 * scoped operation in apps/dev-docs/static/openapi.yaml that lacks it (#2573).
 *
 * Which operations are org-scoped comes from the LIVE router stack, via the same
 * walk scripts/ci/openapi-drift.mjs uses, so this cannot disagree with the check
 * that gates it.
 *
 * `required` is decided per route rather than blanket-set, because
 * `extractOrgId` (middlewares/rbac.ts) reads the path params `orgId`,
 * `organisationId` and `organizationId` BEFORE the header. Where the path
 * already carries the organisation the header is genuinely optional, and
 * marking it required there would send generated clients a header they do not
 * need and make the spec wrong in the other direction.
 *
 * Edits through yaml's document API, which round-trips this file byte-identically,
 * so the 424 hand-refined component schemas and every $ref into them survive.
 *
 *   node scripts/ci/openapi-add-org-header.mjs [--dry-run]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseDocument } from 'yaml';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SPEC_PATH = path.join(REPO_ROOT, 'apps/dev-docs/static/openapi.yaml');
const REQUIRES_ORG = Symbol.for('yosemite.requiresOrgPermissions');

/** The path params extractOrgId consults before falling back to the header. */
const ORG_PATH_PARAMS = ['orgId', 'organisationId', 'organizationId'];

const toOpenApiPath = (p) => p.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
const joinPath = (base, route) => {
  const joined = `${base}${route}`.replace(/\/{2,}/g, '/');
  return joined.length > 1 ? joined.replace(/\/$/, '') : joined;
};

const collectOrgScoped = (registerRoutes) => {
  const orgScoped = new Set();
  const isRouter = (v) =>
    v != null && (typeof v === 'object' || typeof v === 'function') && Array.isArray(v.stack);

  const readRouter = (base, router) => {
    for (const layer of router.stack ?? []) {
      if (!layer.route) continue;
      if (!(layer.route.stack ?? []).some((h) => h.handle && h.handle[REQUIRES_ORG] === true))
        continue;
      for (const method of Object.keys(layer.route.methods ?? {})) {
        orgScoped.add(`${method.toUpperCase()} ${toOpenApiPath(joinPath(base, layer.route.path))}`);
      }
    }
  };

  const app = new Proxy(
    {
      use: (...args) => {
        const base = typeof args[0] === 'string' ? args[0] : '';
        for (const arg of args) if (isRouter(arg)) readRouter(base, arg);
      },
    },
    {
      get: (target, prop) =>
        prop in target
          ? target[prop]
          : (routePath, ...handlers) => {
              if (typeof routePath !== 'string') return;
              if (!handlers.some((h) => h && h[REQUIRES_ORG] === true)) return;
              orgScoped.add(`${String(prop).toUpperCase()} ${toOpenApiPath(routePath)}`);
            },
    }
  );

  registerRoutes(app);
  return orgScoped;
};

const main = async () => {
  const { registerRoutes } = await import(
    path.join(REPO_ROOT, 'apps/backend/src/routers/index.ts')
  );
  const orgScoped = collectOrgScoped(registerRoutes);

  const doc = parseDocument(readFileSync(SPEC_PATH, 'utf8'));
  const paths = doc.get('paths');
  const added = [];

  for (const pathItem of paths.items) {
    const rawPath = String(pathItem.key.value);
    const suppliedByPath = ORG_PATH_PARAMS.some((p) => rawPath.includes(`{${p}}`));

    for (const opEntry of pathItem.value.items ?? []) {
      const verb = String(opEntry.key.value).toUpperCase();
      if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(verb)) continue;
      if (!orgScoped.has(`${verb} ${rawPath}`)) continue;

      const op = opEntry.value;
      const params = op.get('parameters');
      const already = (params?.items ?? []).some((p) => {
        const name = p.get?.('name');
        const location = p.get?.('in');
        return location === 'header' && String(name).toLowerCase() === 'x-org-id';
      });
      if (already) continue;

      const header = doc.createNode({
        name: 'x-org-id',
        in: 'header',
        required: !suppliedByPath,
        description: suppliedByPath
          ? 'Organisation the request acts on. Optional here because the path already carries it; sent otherwise it is ignored in favour of the path.'
          : 'Organisation the request acts on. Required: this route has no organisation in its path, and the request is rejected with 400 without it.',
        schema: { type: 'string' },
      });

      if (params) params.add(header);
      else op.set('parameters', doc.createNode([header]));
      added.push(`${verb} ${rawPath}${suppliedByPath ? ' (optional)' : ' (required)'}`);
    }
  }

  if (process.argv.includes('--dry-run')) {
    console.log(`would add x-org-id to ${added.length} operation(s)`);
    for (const a of added.slice(0, 20)) console.log('  ', a);
    process.exit(0);
  }

  writeFileSync(SPEC_PATH, doc.toString({ lineWidth: 0 }));
  console.log(`added x-org-id to ${added.length} operation(s)`);
  process.exit(0);
};

main().catch((err) => {
  console.error('openapi-add-org-header failed:', err);
  process.exit(2);
});
