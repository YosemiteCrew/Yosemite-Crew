import { demoInvoices } from "../../../pages/Finance/demo";

describe("Finance Demo Data", () => {
  it("exports a valid array of invoices", () => {
    expect(Array.isArray(demoInvoices)).toBe(true);
    expect(demoInvoices).toHaveLength(6);
  });

  it("contains valid invoice objects with required properties", () => {
    // Check the structure of the first item
    const firstInvoice = demoInvoices[0];

    expect(firstInvoice).toHaveProperty("status");
    expect(firstInvoice).toHaveProperty("metadata");
    expect(firstInvoice).toHaveProperty("subtotal");
    expect(firstInvoice).toHaveProperty("tax");
    expect(firstInvoice).toHaveProperty("total");
    expect(firstInvoice).toHaveProperty("date");
    expect(firstInvoice).toHaveProperty("time");

    // Check metadata structure
    expect(firstInvoice.metadata).toHaveProperty("pet");
    expect(firstInvoice.metadata).toHaveProperty("parent");
    expect(firstInvoice.metadata).toHaveProperty("petImage");
    expect(firstInvoice.metadata).toHaveProperty("service");
    expect(firstInvoice.metadata).toHaveProperty("appointmentId");
  });

  it("verifies specific invoice data integrity", () => {
    // specific check for the 'void' status invoice
    const voidInvoice = demoInvoices.find((inv) => inv.status === "void");
    expect(voidInvoice).toBeDefined();
    expect(voidInvoice?.metadata.pet).toBe("Daisy");
    expect(voidInvoice?.total).toBe("70.20");

    // specific check for the 'paid' status invoice
    const paidInvoice = demoInvoices.find((inv) => inv.status === "paid");
    expect(paidInvoice).toBeDefined();
    expect(paidInvoice?.metadata.parent).toBe("Michael Green");
  });
});