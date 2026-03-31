import InvoiceModel from "../../src/models/invoice";

describe("Invoice model", () => {
  it("validates required invoice item fields", () => {
    const doc = new InvoiceModel({
      items: [{ quantity: 1, unitPrice: 10, total: 10 }],
      subtotal: 10,
      totalAmount: 10,
      currency: "USD",
      paymentCollectionMethod: "PAYMENT_INTENT",
      status: "PENDING",
    } as any);

    const error = doc.validateSync();
    expect(error).toBeTruthy();
    expect(error?.errors["items.0.name"]).toBeTruthy();
  });

  it("requires at least one item", () => {
    const doc = new InvoiceModel({
      items: [],
      subtotal: 10,
      totalAmount: 10,
      currency: "USD",
      paymentCollectionMethod: "PAYMENT_INTENT",
      status: "PENDING",
    } as any);

    const error = doc.validateSync();
    expect(error).toBeTruthy();
    expect(error?.errors["items"]).toBeTruthy();
  });

  it("accepts a valid invoice", () => {
    const doc = new InvoiceModel({
      items: [{ name: "Item", quantity: 1, unitPrice: 10, total: 10 }],
      subtotal: 10,
      totalAmount: 10,
      currency: "USD",
      paymentCollectionMethod: "PAYMENT_INTENT",
      status: "PENDING",
    } as any);

    const error = doc.validateSync();
    expect(error).toBeUndefined();
  });
});
