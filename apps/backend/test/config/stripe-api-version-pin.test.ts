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

/**
 * Extensions the walk treats as source. `.mts` and `.cts` are listed even though
 * neither exists here yet: a scan that silently skips a file extension is the
 * same failure as a scan that lists known sites.
 */
const TS_EXTENSIONS = [".ts", ".mts", ".cts"];

/** The one module allowed to contain the pinned literal. */
const PIN_MODULE = path.join("config", "stripe-api-version.ts");

const tsFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return tsFiles(full);
    return entry.isFile() && TS_EXTENSIONS.some((ext) => full.endsWith(ext))
      ? [full]
      : [];
  });

/**
 * Strips block comments and whole-line `//` comments so that the explanation
 * above a client, or a commented-out constructor, cannot be read as a live call
 * site - and cannot satisfy the pin on behalf of one either.
 *
 * A TRAILING `//` comment deliberately survives: `foo(); // new Stripe(` is then
 * read as a call site and fails the scan. That is a false positive, and it is
 * the direction to fail in - the alternative is a stripper that can be used to
 * hide a live client from the guard by putting code after a comment marker.
 */
const withoutComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/**
 * Returns the argument text of every Stripe client construction in `source`,
 * found by balancing parentheses from the opening one rather than by a
 * fixed-width window, so a client whose options object is reformatted or grows
 * a field is still read whole.
 *
 * `new` is OPTIONAL in the pattern because the SDK exports a callable
 * constructor - `stripe/cjs/stripe.cjs.node.d.ts` declares
 * `type StripeCallableConstructor = typeof Stripe_ & { (key, config?): Stripe_ }`
 * - so `Stripe(apiKey, { apiVersion })` with no `new` is a real, type-checking
 * client. Keying this on `new Stripe(` alone would have made the scan a list of
 * one SHAPE, which is the same mistake as a list of known sites: a fifth client
 * written the callable way would pass all three "no site does X" assertions.
 *
 * The lookbehind keeps identifiers that merely END in `Stripe`, and member
 * access, out: `StripeError(`, `someStripe(` and `Stripe.foo(` are not clients.
 *
 * Parenthesis balancing does not track string literals, so an options object
 * containing an unbalanced paren inside a string would truncate the captured
 * argument text and read as unpinned. That is a false positive rather than a
 * miss, which is why it is left alone - but it is also why this walk must not
 * later be "simplified" into something that fails open.
 */
const stripeConstructorArgs = (source: string): string[] => {
  const args: string[] = [];
  const opener = /(?<![\w$.])(?:new\s+)?Stripe\s*\(/g;
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

/**
 * Fixtures for the constructor reader itself.
 *
 * The scan above can only be as wide as this function, and its width is not
 * visible from any assertion that says "no site does X" - those are satisfied
 * for free by a shape the reader does not recognise. So the recognised shapes
 * are pinned here directly, against sources written out in full, rather than
 * left resting on the regex literal that a later cleanup could narrow back.
 */
describe("Stripe client construction reader", () => {
  const found = (source: string) =>
    stripeConstructorArgs(withoutComments(source));

  it("reads the callable form, which the SDK exports and which needs no new", () => {
    // The blocking finding on this PR's first head: `new` was mandatory in the
    // pattern, so a client written this way was invisible to every assertion.
    expect(
      found(
        `const c = Stripe(key, { apiVersion: STRIPE_PINNED_API_VERSION });`,
      ),
    ).toEqual([`key, { apiVersion: STRIPE_PINNED_API_VERSION }`]);
  });

  it("reads the new form", () => {
    expect(
      found(
        `const c = new Stripe(key, { apiVersion: STRIPE_PINNED_API_VERSION });`,
      ),
    ).toEqual([`key, { apiVersion: STRIPE_PINNED_API_VERSION }`]);
  });

  it("reads a client whose arguments contain nested parentheses", () => {
    // The reason the reader balances parentheses instead of taking a window.
    expect(
      found(
        `new Stripe(String(process.env.K ?? ""), {\n` +
          `  apiVersion: STRIPE_PINNED_API_VERSION,\n` +
          `  maxNetworkRetries: Number(process.env.R ?? (1 + 1)),\n` +
          `})`,
      ),
    ).toEqual([
      `String(process.env.K ?? ""), {\n  apiVersion: STRIPE_PINNED_API_VERSION,\n  maxNetworkRetries: Number(process.env.R ?? (1 + 1)),\n}`,
    ]);
  });

  it("finds every client in a file, not just the first", () => {
    expect(found(`new Stripe(a, {});\nStripe(b, {});\n`).length).toBe(2);
  });

  it.each([
    [
      "an error class that merely ends in Stripe",
      `throw new StripeError("x");`,
    ],
    [
      "an identifier that merely ends in Stripe",
      `const c = someStripe(key, {});`,
    ],
    ["member access on the namespace", `const v: Stripe.LatestApiVersion = x;`],
    [
      "a member call on the namespace",
      `Stripe.webhooks.constructEvent(a, b, c);`,
    ],
  ])("does not read %s as a client", (_label, source) => {
    expect(found(source)).toEqual([]);
  });

  it.each([
    ["a block comment", `/* new Stripe(key, { apiVersion: "x" }); */`],
    ["a whole-line comment", `  // new Stripe(key, { apiVersion: "x" });`],
  ])(
    "does not read a client that is commented out with %s",
    (_label, source) => {
      expect(found(source)).toEqual([]);
    },
  );
});
