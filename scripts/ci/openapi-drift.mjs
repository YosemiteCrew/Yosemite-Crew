#!/usr/bin/env node
/**
 * Fails when apps/frontend/public/static/openapi/openapi.yaml has drifted from the routers.
 *
 * The published spec calls itself "generated from backend routers", but there is
 * no generator in the repo - it was produced once and committed, so it cannot
 * track what it claims to describe. The visible symptom was that 276 operations
 * declared `x-org-id` zero times, while `withOrgPermissions()` answers 400 when
 * no organisation can be extracted and the header is the only source on many
 * routes. A client generated from the spec sent requests that could not succeed
 * (#2573).
 *
 * This checks rather than regenerates, deliberately. The spec carries 424
 * hand-refined `components.schemas` entries and `$ref`s into them; rewriting it
 * from a router walk would produce mechanically correct paths and throw all of
 * that away. So the routers stay the source of truth for WHICH routes exist and
 * which are org-scoped, and the spec stays the source of truth for their shapes.
 *
 * Route facts come from the live Express stack rather than from parsing source:
 * a router composed indirectly, or a middleware applied through a helper, is
 * invisible to a grep and present here.
 *
 *   node scripts/ci/openapi-drift.mjs            # report and exit non-zero on drift
 *   node scripts/ci/openapi-drift.mjs --json     # machine-readable
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parse } from 'yaml';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SPEC_PATH = path.join(REPO_ROOT, 'apps/frontend/public/static/openapi/openapi.yaml');
const ORG_HEADER = 'x-org-id';
const REQUIRES_ORG = Symbol.for('yosemite.requiresOrgPermissions');

/** Express path params (`:id`) to OpenAPI templates (`{id}`). */
const toOpenApiPath = (p) => p.replace(/:([A-Za-z0-9_]+)/g, '{$1}');

const joinPath = (base, route) => {
  const joined = `${base}${route}`.replace(/\/{2,}/g, '/');
  return joined.length > 1 ? joined.replace(/\/$/, '') : joined;
};

/**
 * Records what `registerRoutes` mounts. Only the verbs and `use` are needed;
 * anything else an Express app is asked for is a no-op so the import does not
 * die on a method this stub does not model.
 */
const collectRoutes = (registerRoutes) => {
  const found = [];

  const readRouter = (base, router) => {
    for (const layer of router.stack ?? []) {
      if (!layer.route) continue;
      const handlers = layer.route.stack ?? [];
      const orgScoped = handlers.some((h) => h.handle && h.handle[REQUIRES_ORG] === true);
      for (const method of Object.keys(layer.route.methods ?? {})) {
        found.push({
          method: method.toUpperCase(),
          path: toOpenApiPath(joinPath(base, layer.route.path)),
          orgScoped,
        });
      }
    }
  };

  /* An Express Router is a FUNCTION carrying a `stack`, not a plain object, so
     a `typeof === 'object'` test silently matches nothing and the walk reports
     one route. */
  const isRouter = (v) =>
    v != null && (typeof v === 'object' || typeof v === 'function') && Array.isArray(v.stack);

  const app = new Proxy(
    {
      use: (...args) => {
        const base = typeof args[0] === 'string' ? args[0] : '';
        for (const arg of args) if (isRouter(arg)) readRouter(base, arg);
      },
    },
    {
      get(target, prop) {
        if (prop in target) return target[prop];
        // A verb registered straight on the app rather than through a router.
        return (routePath, ...handlers) => {
          if (typeof routePath !== 'string') return;
          const orgScoped = handlers.some((h) => h && h[REQUIRES_ORG] === true);
          found.push({
            method: String(prop).toUpperCase(),
            path: toOpenApiPath(routePath),
            orgScoped,
          });
        };
      },
    }
  );

  registerRoutes(app);
  return found;
};

const specOperations = (spec) => {
  const ops = new Map();
  for (const [rawPath, item] of Object.entries(spec.paths ?? {})) {
    for (const [method, op] of Object.entries(item ?? {})) {
      const verb = method.toUpperCase();
      if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(verb)) continue;
      const params = [...(item.parameters ?? []), ...(op?.parameters ?? [])];
      const declaresOrgHeader = params.some(
        (p) => p && p.in === 'header' && String(p.name).toLowerCase() === ORG_HEADER
      );
      ops.set(`${verb} ${rawPath}`, { declaresOrgHeader });
    }
  }
  return ops;
};

const main = async () => {
  const { registerRoutes } = await import(
    path.join(REPO_ROOT, 'apps/backend/src/routers/index.ts')
  );

  const routes = collectRoutes(registerRoutes);
  const spec = parse(readFileSync(SPEC_PATH, 'utf8'));
  const ops = specOperations(spec);

  const missingFromSpec = [];
  const missingOrgHeader = [];

  for (const route of routes) {
    const key = `${route.method} ${route.path}`;
    const op = ops.get(key);
    if (!op) {
      missingFromSpec.push(key);
      continue;
    }
    if (route.orgScoped && !op.declaresOrgHeader) missingOrgHeader.push(key);
  }

  const mounted = new Set(routes.map((r) => `${r.method} ${r.path}`));
  const staleInSpec = [...ops.keys()].filter((k) => !mounted.has(k));

  const report = {
    mountedRoutes: routes.length,
    orgScopedRoutes: routes.filter((r) => r.orgScoped).length,
    specOperations: ops.size,
    missingFromSpec,
    missingOrgHeader,
    staleInSpec,
  };

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(
      `openapi-drift: ${report.mountedRoutes} mounted routes, ` +
        `${report.orgScopedRoutes} organisation-scoped, ${report.specOperations} spec operations`
    );
    const show = (label, list) => {
      if (list.length === 0) return;
      console.log(`\n${label} (${list.length}):`);
      for (const k of list.slice(0, 40)) console.log(`  ${k}`);
      if (list.length > 40) console.log(`  ... and ${list.length - 40} more`);
    };
    show('Mounted but absent from the spec', missingFromSpec);
    show(`Organisation-scoped but missing the ${ORG_HEADER} header`, missingOrgHeader);
    show('In the spec but no longer mounted', staleInSpec);
  }

  /* Only the org-header check is fatal for now. The route-coverage counts are
     reported so the gap is visible, but failing on them today would block every
     PR on a backlog this change does not attempt to clear - the header is the
     defect #2573 is about, and it is the one that makes generated clients send
     requests that cannot succeed. */
  /* A guard on the guard. If the REQUIRES_ORG marker ever stops being applied -
     renamed, dropped in a refactor, or lost because a router composes the
     middleware some new way - every route reads as unscoped, `missingOrgHeader`
     is empty and this check passes while verifying nothing. There are 745
     org-scoped routes today; zero means the detection broke, not that the
     codebase changed. */
  if (report.orgScopedRoutes === 0) {
    console.error(
      '\nopenapi-drift: no organisation-scoped routes were detected, which cannot be right. ' +
        'The REQUIRES_ORG marker set in middlewares/rbac.ts is probably no longer reaching the ' +
        'router stack, so this check is verifying nothing.'
    );
    process.exit(1);
  }

  if (missingOrgHeader.length > 0) {
    console.error(
      `\nopenapi-drift: ${missingOrgHeader.length} organisation-scoped operation(s) do not ` +
        `declare the ${ORG_HEADER} header, so a client generated from this spec would be ` +
        `rejected with 400 before reaching a controller.`
    );
    process.exit(1);
  }

  /* Importing the routers pulls in clients and timers that keep the loop alive,
     so the process is ended explicitly rather than left to hang in CI. */
  process.exit(0);
};

main().catch((err) => {
  console.error('openapi-drift failed to run:', err);
  process.exit(2);
});
