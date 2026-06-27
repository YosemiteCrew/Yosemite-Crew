import {
  FakeGateway,
  PaymentProviderRegistry,
  UnknownProviderError,
  resolveAdapterForOrg,
} from "src/services/payments";

describe("PaymentProviderRegistry", () => {
  it("registers and resolves an adapter by provider id", () => {
    const registry = new PaymentProviderRegistry();
    const stripe = new FakeGateway({ provider: "STRIPE" });
    registry.register(stripe);
    expect(registry.has("STRIPE")).toBe(true);
    expect(registry.get("STRIPE")).toBe(stripe);
  });

  it("throws UnknownProviderError for an unregistered provider", () => {
    const registry = new PaymentProviderRegistry();
    expect(registry.has("CARECREDIT")).toBe(false);
    expect(() => registry.get("CARECREDIT")).toThrow(UnknownProviderError);
  });

  it("lists registered providers", () => {
    const registry = new PaymentProviderRegistry();
    registry.register(new FakeGateway({ provider: "STRIPE" }));
    registry.register(new FakeGateway({ provider: "MANUAL" }));
    expect(registry.list().sort()).toEqual(["MANUAL", "STRIPE"]);
  });

  it("resolves the adapter for an org's active provider", () => {
    const registry = new PaymentProviderRegistry();
    const stripe = new FakeGateway({ provider: "STRIPE" });
    registry.register(stripe);
    expect(resolveAdapterForOrg(registry, "STRIPE")).toBe(stripe);
  });

  it("replaces the adapter when a provider is registered again", () => {
    const registry = new PaymentProviderRegistry();
    const first = new FakeGateway({ provider: "STRIPE" });
    const second = new FakeGateway({ provider: "STRIPE" });
    registry.register(first);
    registry.register(second);
    expect(registry.get("STRIPE")).toBe(second);
    expect(registry.list()).toEqual(["STRIPE"]);
  });
});
