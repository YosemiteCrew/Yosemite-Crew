import fs from "fs";
import path from "path";

/**
 * Repo-wide guard for the route authorization chain.
 *
 * `requirePermission` reads `req.userPermissions`, which is populated by an
 * org-permission loader (`withOrgPermissions()` and its scoped variants), which
 * in turn needs `req.userId` from an authentication middleware. If a route
 * declares `requirePermission` without those ahead of it, the middleware is
 * fail-closed and returns:
 *
 *   500 "Permissions not loaded. Include withOrgPermissions before requirePermission."
 *
 * That is not a security hole, but it silently makes the endpoint unusable - the
 * failure only shows up at runtime, never at compile time, and never in a unit
 * test of the controller. This test enforces the invariant statically across
 * every router so a new endpoint cannot ship in that state.
 */

const ROUTERS_DIR = path.join(__dirname, "..", "..", "src", "routers");

/** Middlewares that establish the caller's identity (`req.userId`). */
const AUTH_MIDDLEWARES = [
  "requireWebAuth",
  "requireMobileAuth",
  "requireAnyAuth",
  "attachSessionIfPresent",
];

/**
 * Middlewares that resolve the caller's membership into `req.userPermissions`.
 * Scoped variants (appointment-, rendered-document-) do the same job for routes
 * whose organisation is derived from the resource rather than the path.
 */
const PERMISSION_LOADER = /with[A-Za-z]*OrgPermissions\s*\(/;

/**
 * Routers that already violate the invariant on `dev`, each with exactly one
 * offending route. They are recorded here rather than fixed silently, because
 * the fix is not mechanical: these routes are deliberately not org-scoped (no
 * organisationId in the path), so they need a permission source that does not
 * exist yet rather than a `withOrgPermissions()` call.
 *
 * Do not add to this list. A new entry means a new endpoint that answers 500 to
 * every request.
 */
const KNOWN_PREEXISTING_VIOLATIONS = new Map<string, number>([
  // GET /companions/org/search - global search, not scoped to one organisation
  ["companion.router.ts", 1],
  ["inventory.router.ts", 1],
  ["prescription.router.ts", 1],
]);

const routerFiles = fs
  .readdirSync(ROUTERS_DIR)
  .filter((f) => f.endsWith(".ts") && f !== "index.ts")
  .sort();

/**
 * Strips comments and import statements so that a mention of a middleware in a
 * doc comment or import cannot satisfy the invariant on its own.
 */
const routeBody = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/^import[\s\S]*?from\s*"[^"]*";$/gm, "");

describe("route authorization invariant", () => {
  it("finds router modules to check", () => {
    expect(routerFiles.length).toBeGreaterThan(0);
  });

  describe.each(routerFiles)("%s", (file) => {
    const source = fs.readFileSync(path.join(ROUTERS_DIR, file), "utf8");
    const body = routeBody(source);
    const usesRequirePermission = /\brequirePermission\s*\(/.test(body);

    it("loads permissions before requiring them", () => {
      if (!usesRequirePermission) {
        return;
      }
      expect(PERMISSION_LOADER.test(body)).toBe(true);
    });

    it("authenticates before resolving permissions", () => {
      if (!usesRequirePermission) {
        return;
      }
      const authenticated = AUTH_MIDDLEWARES.some((m) =>
        new RegExp(`\\b${m}\\b`).test(body),
      );
      expect(authenticated).toBe(true);
    });

    it("orders auth -> permission loader -> permission check on every route", () => {
      if (!usesRequirePermission) {
        return;
      }

      // Walk each registration's middleware list in source order and assert the
      // gate is preceded by a loader, which is itself preceded by auth.
      const tokens = [
        ...body.matchAll(
          /\b(requireWebAuth|requireMobileAuth|requireAnyAuth|attachSessionIfPresent)\b|\bwith[A-Za-z]*OrgPermissions\s*\(|\brequirePermission\s*\(/g,
        ),
      ].map((m) => {
        const t = m[0];
        if (t.includes("OrgPermissions")) return "loader";
        if (t.startsWith("requirePermission")) return "gate";
        return "auth";
      });

      let sawAuth = false;
      let sawLoader = false;
      const violations: string[] = [];

      for (const token of tokens) {
        if (token === "auth") {
          sawAuth = true;
          sawLoader = false;
          continue;
        }
        if (token === "loader") {
          if (!sawAuth) violations.push("permission loader before any auth");
          sawLoader = true;
          continue;
        }
        // token === "gate"
        if (!sawAuth) violations.push("requirePermission before any auth");
        else if (!sawLoader)
          violations.push("requirePermission without a permission loader");
        sawLoader = false;
      }

      const allowed = KNOWN_PREEXISTING_VIOLATIONS.get(file) ?? 0;
      // Pinned to the exact known count so the debt can shrink but never grow.
      expect(violations.length).toBe(allowed);
    });
  });
});
