import { MerckAdapter } from "src/integrations/merck/merck.adapter";

describe("MerckAdapter", () => {
  it("returns ok for credential validation", async () => {
    const adapter = new MerckAdapter();
    await expect(adapter.validateCredentials()).resolves.toEqual({ ok: true });
  });
});
