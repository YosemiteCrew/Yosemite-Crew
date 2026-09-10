#!/usr/bin/env node
/**
 * Fails when apps/frontend/public/static/openapi/openapi.yaml has drifted from the routers.
 *
 * The published spec is hand-written and committed, not generated - there is no
 * generator in the repo, so nothing keeps it in sync automatically. The visible
 * symptom was that 276 operations
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
 *   node scripts/ci/openapi-drift.mjs                  # report and exit non-zero on drift
 *   node scripts/ci/openapi-drift.mjs --json           # machine-readable
 *   node scripts/ci/openapi-drift.mjs --update-baseline  # rewrite the ratchet file to current counts
 *
 * Three counts beyond the org-header check are ratcheted against
 * openapi-drift-baseline.json rather than required to be zero: missingFromSpec
 * (mounted routes absent from the spec), staleInSpec (spec operations with no
 * matching mount), and placeholderSchemas (request/response bodies documented
 * as a bare `additionalProperties: true` with no properties - true today of
 * 371 operations, see #2944). None of the three can go to zero in one PR, so
 * requiring zero would either block everything or get bypassed; the ratchet
 * instead fails only when a PR makes one of them WORSE than the committed
 * baseline, so the gap can shrink over time but never silently grows.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parse } from 'yaml';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SPEC_PATH = path.join(REPO_ROOT, 'apps/frontend/public/static/openapi/openapi.yaml');
const BASELINE_PATH = path.join(REPO_ROOT, 'scripts/ci/openapi-drift-baseline.json');
const ORG_HEADER = 'x-org-id';
const REQUIRES_ORG = Symbol.for('yosemite.requiresOrgPermissions');
const RATCHETED_KEYS = ['missingFromSpec', 'staleInSpec', 'placeholderSchemas'];

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

/**
 * Request/response bodies documented as a bare `{ additionalProperties: true }`
 * with no `properties` key - an operation whose shape was never actually
 * written down, as opposed to a `components.schemas` entry that legitimately
 * carries `additionalProperties: true` alongside real `properties` to allow
 * extra fields. Walks the whole document rather than just `paths`, since a
 * placeholder can also sit inside a named component schema referenced from a
 * path.
 */
const MAX_WALK_DEPTH = 1000;

const placeholderSchemaCount = (spec) => {
  let count = 0;
  const walk = (node, depth = 0) => {
    if (depth >= MAX_WALK_DEPTH || node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const v of node) walk(v, depth + 1);
      return;
    }
    if (node.additionalProperties === true && !node.properties) count++;
    for (const key of Object.keys(node)) walk(node[key], depth + 1);
  };
  walk(spec);
  return count;
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
  const placeholderSchemas = placeholderSchemaCount(spec);

  const report = {
    mountedRoutes: routes.length,
    orgScopedRoutes: routes.filter((r) => r.orgScoped).length,
    specOperations: ops.size,
    missingFromSpec,
    missingOrgHeader,
    staleInSpec,
    placeholderSchemas,
  };

  if (process.argv.includes('--update-baseline')) {
    const baseline = {
      _comment: JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))._comment,
      missingFromSpec: missingFromSpec.length,
      staleInSpec: staleInSpec.length,
      placeholderSchemas,
    };
    writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`);
    console.log(`openapi-drift: wrote new baseline to ${path.relative(REPO_ROOT, BASELINE_PATH)}`);
    console.log(JSON.stringify(baseline, null, 2));
    process.exit(0);
  }

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
    console.log(
      `\nPlaceholder request/response schemas (additionalProperties only, no shape): ${placeholderSchemas}`
    );
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

  /* Ratchet: missingFromSpec, staleInSpec and placeholderSchemas cannot go to
     zero in one PR (~800 routes are undocumented today, tracked in #2941-#2944),
     so this fails only when a count exceeds its committed baseline - a PR can
     hold the line or improve it, never widen it in silence. */
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  const countOf = (key) => (Array.isArray(report[key]) ? report[key].length : report[key]);
  const regressions = RATCHETED_KEYS.filter((key) => countOf(key) > baseline[key]).map((key) => ({
    key,
    was: baseline[key],
    now: countOf(key),
  }));
  if (regressions.length > 0) {
    console.error('\nopenapi-drift: this change widens the documented gap beyond its baseline:');
    for (const r of regressions) {
      console.error(`  ${r.key}: baseline ${r.was} -> now ${r.now}`);
    }
    console.error(
      `\nAdd the new route(s)/schema(s) to the spec, or run ` +
        `'node scripts/ci/openapi-drift.mjs --update-baseline' if this PR genuinely reduces the gap ` +
        `elsewhere and the increase here is deliberate and reviewed.`
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
