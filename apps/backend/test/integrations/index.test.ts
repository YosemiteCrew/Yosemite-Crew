import { getIntegrationAdapter } from "src/integrations";
import { IdexxAdapter } from "src/integrations/idexx/idexx.adapter";
import { MerckAdapter } from "src/integrations/merck/merck.adapter";

describe("integrations index", () => {
  it("returns adapters for known providers", () => {
    const idexx = getIntegrationAdapter("IDEXX");
    const merck = getIntegrationAdapter("MERCK_MANUALS");

    expect(idexx).toBeInstanceOf(IdexxAdapter);
    expect(merck).toBeInstanceOf(MerckAdapter);
  });
});
