import IntegrationAccountModel from "../../src/models/integration-account";

describe("IntegrationAccount model", () => {
  it("removes credentials from toJSON and toObject", () => {
    const doc = new IntegrationAccountModel({
      organisationId: "org",
      provider: "IDEXX",
      status: "enabled",
      credentials: { username: "user" },
    });

    const json = doc.toJSON();
    const obj = doc.toObject();

    expect(json.credentials).toBeUndefined();
    expect(obj.credentials).toBeUndefined();
  });
});
