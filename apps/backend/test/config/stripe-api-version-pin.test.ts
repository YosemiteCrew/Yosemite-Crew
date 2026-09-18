import fs from "fs";
import path from "path";

import { STRIPE_PINNED_API_VERSION } from "src/config/stripe-api-version";

/**
 * Guard for the Stripe API version pin.
 *
 * The pinned version selects the request and webhook shapes this account is
 * billed and reconciled against, so moving it is a billing change that needs its
 * own pull request. Until `stripe` 22.6.2 the type system enforced that on its
 * own: the literal was checked against `Stripe.LatestApiVersion`, so a wrong
 * version failed to compile. That bump moved the union past the pinned string,
 * the literal had to be asserted, and with the assertion in place *any* string
 * now compiles at every call site.
 *
 * So the compiler no longer holds this property and something else has to. Two
 * distinct failures are in scope, and they need different assertions:
 *
 *  1. The version silently moving. Covered by holding the expected value as a
 *     literal *here*, independently of the source. A test that read the constant
 *     and compared it to itself would pass for any value - it would be pinning
 *     the copying, not the version.
 *
 *  2. A fifth Stripe client arriving without the pin, which is the likelier of
 *     the two: the existing four are unlikely to be edited, but a new billing
 *     surface starts with a fresh `new Stripe(...)`. Covered by scanning the
 *     source rather than by listing the four known sites, because a list of
 *     known sites is exactly what a new site is absent from.
 */

const SRC_DIR = path.join(__dirname, "..", "..", "src");

/** The value the four clients are pinned to, held here as a literal on purpose. */
const EXPECTED_API_VERSION = "2026-07-29.dahlia";

/** The one module allowed to contain the pinned literal. */
const PIN_MODULE = path.join("config", "stripe-api-version.ts");

const tsFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return tsFiles(full);
    return entry.isFile() && full.endsWith(".ts") ? [full] : [];
  });

/**
 * Strips block and line comments so that the explanation above a client, or a
 * commented-out constructor, cannot be read as a live call site - and cannot
 * satisfy the pin on behalf of one either.
 */
const withoutComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/**
 * Returns the argument text of every `new Stripe(...)` in `source`, found by
 * balancing parentheses from the opening one rather than by a fixed-width
 * window, so a client whose options object is reformatted or grows a field is
 * still read whole.
 */
const stripeConstructorArgs = (source: string): string[] => {
  const args: string[] = [];
  const opener = /new\s+Stripe\s*\(/g;
  let match = opener.exec(source);
  while (match !== null) {
    let depth = 1;
    let i = match.index + match[0].length;
    const start = i;
    while (i < source.length && depth > 0) {
      if (source[i] === "(") depth += 1;
      else if (source[i] === ")") depth -= 1;
      i += 1;
    }
    args.push(source.slice(start, i - 1));
    match = opener.exec(source);
  }
  return args;
};

const sourceFiles = tsFiles(SRC_DIR).map((file) => ({
  file,
  relative: path.relative(SRC_DIR, file),
  body: withoutComments(fs.readFileSync(file, "utf8")),
}));

const clientSites = sourceFiles.flatMap(({ relative, body }) =>
  stripeConstructorArgs(body).map((args) => ({ relative, args })),
);

describe("Stripe API version pin", () => {
  it("pins the version to the reviewed value", () => {
    // Deliberately compared against a literal, not against the import. If this
    // fails, the API version was changed - that is a billing change and belongs
    // in its own pull request with its own reconciliation testing, not in the
    // diff that tripped this assertion.
    expect(STRIPE_PINNED_API_VERSION).toBe(EXPECTED_API_VERSION);
  });

  it("scans a source tree that actually contains Stripe clients", () => {
    // Liveness. Every assertion below is of the form "no site does X", which is
    // satisfied for free by finding no sites at all.
    expect(sourceFiles.length).toBeGreaterThan(0);
    expect(clientSites.length).toBeGreaterThan(0);
  });

  it("gives every Stripe client the shared pinned version", () => {
    const unpinned = clientSites
      .filter(({ args }) => !/\bSTRIPE_PINNED_API_VERSION\b/.test(args))
      .map(({ relative }) => relative);

    expect(unpinned).toEqual([]);
  });

  it("keeps the pinned literal in one module", () => {
    const copies = sourceFiles
      .filter(({ relative, body }) => relative !== PIN_MODULE)
      .filter(({ body }) => body.includes(EXPECTED_API_VERSION))
      .map(({ relative }) => relative);

    expect(copies).toEqual([]);
  });

  it("imports the constant in every file that builds a client", () => {
    const filesWithClients = [
      ...new Set(clientSites.map(({ relative }) => relative)),
    ];
    const missingImport = filesWithClients.filter((relative) => {
      const entry = sourceFiles.find((f) => f.relative === relative);
      return !/import\s*\{[^}]*\bSTRIPE_PINNED_API_VERSION\b[^}]*\}\s*from/.test(
        entry?.body ?? "",
      );
    });

    expect(missingImport).toEqual([]);
  });
});
