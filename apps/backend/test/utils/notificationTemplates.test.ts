import { NotificationTemplates } from "../../src/utils/notificationTemplates";

describe("NotificationTemplates", () => {
  describe("Appointment Notifications", () => {
    it("should format REQUESTED correctly", () => {
      const result = NotificationTemplates.Appointment.REQUESTED("Buddy", "10:00 AM");
      expect(result).toEqual({
        title: "Appointment Request Sent! 🐾",
        body: "Buddy is all set! Your appointment request for 10:00 AM has been sent to the clinic.",
        type: "APPOINTMENTS",
      });
    });

    it("should format APPROVED correctly", () => {
      const result = NotificationTemplates.Appointment.APPROVED("Max", "Tomorrow at 2:00 PM");
      expect(result).toEqual({
        title: "Appointment Confirmed! 🎉",
        body: "Great news! Max's appointment is confirmed for Tomorrow at 2:00 PM. See you soon!",
        type: "APPOINTMENTS",
      });
    });

    it("should format CANCELLED correctly", () => {
      const result = NotificationTemplates.Appointment.CANCELLED("Bella");
      expect(result).toEqual({
        title: "Appointment Cancelled ❌",
        body: "Your appointment for Bella has been cancelled. We're here if you need to rebook.",
        type: "APPOINTMENTS",
      });
    });

    it("should format REMINDER correctly", () => {
      const result = NotificationTemplates.Appointment.REMINDER("Luna", "04:30 PM");
      expect(result).toEqual({
        title: "Upcoming Appointment ⏰",
        body: "A little nudge! Luna has an appointment at 04:30 PM. Don’t forget!",
        type: "APPOINTMENTS",
      });
    });

    it("should format RESCHEDULED correctly", () => {
      const result = NotificationTemplates.Appointment.RESCHEDULED("Charlie", "Friday at 1:00 PM");
      expect(result).toEqual({
        title: "Appointment Rescheduled 🔁",
        body: "Charlie's appointment has been moved to Friday at 1:00 PM. Thanks for staying flexible!",
        type: "APPOINTMENTS",
      });
    });
  });

  describe("Payment Notifications", () => {
    it("should format PAYMENT_PENDING correctly", () => {
      const result = NotificationTemplates.Payment.PAYMENT_PENDING(1500);
      expect(result).toEqual({
        title: "Payment Pending 💳",
        body: "A quick reminder! You have a pending payment of ₹1500. Tap to complete it.",
        type: "PAYMENTS",
      });
    });

    it("should format PAYMENT_SUCCESS correctly", () => {
      const result = NotificationTemplates.Payment.PAYMENT_SUCCESS(500.5);
      expect(result).toEqual({
        title: "Payment Successful! 🥳",
        body: "Woohoo! Your payment of ₹500.5 went through. Thanks for taking great care of your companion!",
        type: "PAYMENTS",
      });
    });

    it("should format PAYMENT_FAILED correctly", () => {
      const result = NotificationTemplates.Payment.PAYMENT_FAILED();
      expect(result).toEqual({
        title: "Payment Failed ⚠️",
        body: "Oops! Something went wrong with your payment. Try again when you’re ready.",
        type: "PAYMENTS",
      });
    });

    it("should format REFUND_ISSUED correctly", () => {
      const result = NotificationTemplates.Payment.REFUND_ISSUED(200);
      expect(result).toEqual({
        title: "Refund Processed 💸",
        body: "A refund of ₹200 has been processed. Check your bank for updates.",
        type: "PAYMENTS",
      });
    });
  });

  describe("Expense Notifications", () => {
    it("should format EXPENSE_ADDED correctly and lowercase the category", () => {
      // Pass an uppercase category to ensure .toLowerCase() is covered and works properly
      const result = NotificationTemplates.Expense.EXPENSE_ADDED("Daisy", "GROOMING");
      expect(result).toEqual({
        title: "New Expense Added 📘",
        body: "You added a new grooming expense for Daisy.",
        // No type is defined in the template
      });
    });

    it("should format EXPENSE_UPDATED correctly", () => {
      const result = NotificationTemplates.Expense.EXPENSE_UPDATED("Rocky");
      expect(result).toEqual({
        title: "Expense Updated ✏️",
        body: "An expense for Rocky has been updated.",
      });
    });
  });

  describe("Care Notifications", () => {
    it("should format VACCINE_REMINDER correctly", () => {
      const result = NotificationTemplates.Care.VACCINE_REMINDER("Zeus");
      expect(result).toEqual({
        title: "Vaccination Due 🩺",
        body: "Zeus is due for a vaccination. Staying protected is the best treat!",
      });
    });

    it("should format MEDICATION_REMINDER correctly", () => {
      const result = NotificationTemplates.Care.MEDICATION_REMINDER("Coco");
      expect(result).toEqual({
        title: "Medication Reminder 💊",
        body: "Time for Coco's meds. Healthy companions = happy parents!",
      });
    });
  });

  describe("Auth Notifications", () => {
    it("should format OTP correctly", () => {
      const result = NotificationTemplates.Auth.OTP("789456");
      expect(result).toEqual({
        title: "Your OTP is Ready! 🔐",
        body: "Use this code to continue: 789456. It’s valid for the next 10 minutes!",
      });
    });
  });
});