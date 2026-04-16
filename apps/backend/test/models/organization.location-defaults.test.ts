import OrganizationModel from "src/models/organization";

describe("OrganizationModel address.location defaults", () => {
  it("does not create address.location when coordinates are missing", () => {
    const doc = new OrganizationModel({
      name: "Test Org",
      taxId: "taxid",
      type: "HOSPITAL",
      phoneNo: "+10000000000",
      address: { addressLine: "Line 1" },
    });

    expect(doc.address?.location).toBeUndefined();
  });
});
