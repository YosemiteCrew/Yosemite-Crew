import { DemoPayments } from "../../../../../../pages/Appointments/Sections/AppointmentInfo/Finance/demo";

describe("Finance Demo Data", () => {
  // --- Section 1: Array Structure & Integrity ---

  it("should be defined and satisfy array structure", () => {
    expect(DemoPayments).toBeDefined();
    expect(Array.isArray(DemoPayments)).toBe(true);
  });

  it("should have the correct number of mock records", () => {
    // We expect exactly 2 records based on the source file
    expect(DemoPayments).toHaveLength(2);
  });

  // --- Section 2: First Record Verification ---

  it("should contain correct data for the first payment (Credit Card)", () => {
    const payment = DemoPayments[0];

    expect(payment).toEqual({
      appointmentId: "APT-001",
      paymentId: "PAY-1001",
      mode: "Credit Card",
      date: "2025-02-10",
      time: "14:30",
      status: "Completed",
      amount: "120.00",
    });
  });

  // --- Section 3: Second Record Verification ---

  it("should contain correct data for the second payment (UPI)", () => {
    const payment = DemoPayments[1];

    expect(payment).toEqual({
      appointmentId: "APT-002",
      paymentId: "PAY-1002",
      mode: "UPI",
      date: "2025-02-11",
      time: "10:15",
      status: "Pending",
      amount: "75.50",
    });
  });

  // --- Section 4: Type/Schema Consistency ---

  it("should ensure all items have required payment fields", () => {
    DemoPayments.forEach((payment) => {
      expect(payment).toHaveProperty("appointmentId");
      expect(payment).toHaveProperty("paymentId");
      expect(payment).toHaveProperty("amount");
      expect(payment).toHaveProperty("status");
      expect(payment).toHaveProperty("mode");
      expect(payment).toHaveProperty("date");
      expect(payment).toHaveProperty("time");

      // Basic type checks
      expect(typeof payment.amount).toBe("string");
      expect(typeof payment.paymentId).toBe("string");
    });
  });
});