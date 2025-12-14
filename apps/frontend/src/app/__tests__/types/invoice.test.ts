import { InvoicesStatus, InvoiceProps, InvoiceMetadata } from "@/app/types/invoice";

describe("Invoice Types and Constants", () => {
  // --- 1. Constant Validation (Runtime Code) ---
  it("should export InvoicesStatus constant with correct values", () => {
    expect(InvoicesStatus).toBeDefined();
    expect(Array.isArray(InvoicesStatus)).toBe(true);
    expect(InvoicesStatus).toHaveLength(6);

    const expectedStatuses = [
      "open",
      "draft",
      "void",
      "uncollectible",
      "deleted",
      "paid",
    ];

    expectedStatuses.forEach((status) => {
      expect(InvoicesStatus).toContain(status);
    });
  });

  // --- 2. Type Structure Validation ---
  it("should validate InvoiceMetadata object structure", () => {
    // Create an object adhering to the type
    const metadata: InvoiceMetadata = {
      pet: "Buddy",
      parent: "John Doe",
      petImage: "/images/dog.png",
      service: "Vaccination",
      appointmentId: "appt-123",
    };

    // Verify properties
    expect(metadata.pet).toBe("Buddy");
    expect(metadata.parent).toBe("John Doe");
    expect(metadata.appointmentId).toBe("appt-123");
  });

  it("should validate InvoiceProps object structure", () => {
    // Create an object adhering to the type
    const invoice: InvoiceProps = {
      status: "paid", // Literal type check
      subtotal: "100.00",
      tax: "10.00",
      total: "110.00",
      date: "2023-10-01",
      time: "10:00 AM",
      metadata: {
        pet: "Rex",
        parent: "Jane Smith",
        petImage: "",
        service: "Surgery",
        appointmentId: "appt-456",
      },
    };

    // Verify properties
    expect(invoice.status).toBe("paid");
    expect(invoice.total).toBe("110.00");
    expect(invoice.metadata.service).toBe("Surgery");
  });
});