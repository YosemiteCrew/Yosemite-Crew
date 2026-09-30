import {
  AVAILABLE_INTEGRATION_PROVIDERS,
  NOT_YET_AVAILABLE_INTEGRATION_PROVIDERS,
  isProviderAvailable,
} from "src/integrations/providerAvailability";
import { validateRequiredCredentials } from "src/integrations/requiredCredentials";
import { INTEGRATION_PROVIDERS } from "src/integrations/types";

describe("integration provider availability", () => {
  it("classifies every provider as either available or not yet available", () => {
    const classified = [
      ...new Set([
        ...AVAILABLE_INTEGRATION_PROVIDERS,
        ...NOT_YET_AVAILABLE_INTEGRATION_PROVIDERS,
      ]),
    ].sort();
    const all = [...INTEGRATION_PROVIDERS].sort();

    expect(classified).toEqual(all);
  });

  it("never classifies a provider as both", () => {
    const available = new Set<string>(AVAILABLE_INTEGRATION_PROVIDERS);

    expect(
      NOT_YET_AVAILABLE_INTEGRATION_PROVIDERS.filter((provider) =>
        available.has(provider),
      ),
    ).toEqual([]);
  });

  it("only offers providers that connect, and everything else is coming soon", () => {
    expect([...AVAILABLE_INTEGRATION_PROVIDERS].sort()).toEqual([
      "IDEXX",
      "MERCK_MANUALS",
    ]);

    for (const provider of INTEGRATION_PROVIDERS) {
      expect(isProviderAvailable(provider)).toBe(
        AVAILABLE_INTEGRATION_PROVIDERS.includes(provider),
      );
    }
  });
});

describe("validateRequiredCredentials", () => {
  it("does not report a connection for a well-formed payload", async () => {
    await expect(
      validateRequiredCredentials("LAIKA", { apiKey: "shape check only" }, [
        "apiKey",
      ]),
    ).resolves.toEqual({
      ok: false,
      reason: "LAIKA cannot be validated until a connection is available.",
    });
  });

  it("still rejects a missing or blank field for a provider that is not connected yet", async () => {
    await expect(
      validateRequiredCredentials<{ apiKey: string }>("LAIKA", undefined, [
        "apiKey",
      ]),
    ).resolves.toEqual({ ok: false, reason: "Missing credentials." });

    await expect(
      validateRequiredCredentials("LAIKA", { apiKey: "   " }, ["apiKey"]),
    ).resolves.toEqual({ ok: false, reason: "apiKey is required." });
  });

  // A shape check cannot tell a working key from any other text, so it must not
  // be able to pass off a provider as connectable. Moving a provider into
  // AVAILABLE_INTEGRATION_PROVIDERS while its adapter is still this helper has
  // to fail here rather than accept whatever text it is given.
  it("refuses to answer for a provider that is available", async () => {
    const result = await validateRequiredCredentials(
      "IDEXX",
      { apiKey: "any text at all" },
      ["apiKey"],
    );

    expect(result).toEqual({
      ok: false,
      reason: "IDEXX must verify the connection before it can be saved.",
    });
  });
});
