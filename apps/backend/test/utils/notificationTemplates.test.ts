import { NotificationTemplates } from "../../src/utils/notificationTemplates";

describe("NotificationTemplates", () => {
  // 1. Appointment Notifications
  describe("Appointment", () => {
    it("REQUESTED: should return correct payload", () => {
      const result = NotificationTemplates.Appointment.REQUESTED(
        "Buddy",
        "10:00 AM",
      );
      expect(result).toEqual({
        title: "Appointment Request Sent! 🐾",
        body: "Buddy is all set! Your appointment request for 10:00 AM has been sent to the clinic.",
        type: "APPOINTMENTS",
      });
    });

    it("APPROVED: should return correct payload", () => {
      const result = NotificationTemplates.Appointment.APPROVED(
        "Buddy",
        "10:00 AM",
      );
      expect(result).toEqual({
        title: "Appointment Confirmed! 🎉",
        body: "Great news! Buddy's appointment is confirmed for 10:00 AM. See you soon!",
        type: "APPOINTMENTS",
      });
    });

    it("CANCELLED: should return correct payload", () => {
      const result = NotificationTemplates.Appointment.CANCELLED("Buddy");
      expect(result).toEqual({
        title: "Appointment Cancelled ❌",
        body: "Your appointment for Buddy has been cancelled. We're here if you need to rebook.",
        type: "APPOINTMENTS",
      });
    });

    it("REMINDER: should return correct payload", () => {
      const result = NotificationTemplates.Appointment.REMINDER(
        "Buddy",
        "10:00 AM",
      );
      expect(result).toEqual({
        title: "Upcoming Appointment ⏰",
        body: "A little nudge! Buddy has an appointment at 10:00 AM. Don’t forget!",
        type: "APPOINTMENTS",
      });
    });

    it("RESCHEDULED: should return correct payload", () => {
      const result = NotificationTemplates.Appointment.RESCHEDULED(
        "Buddy",
        "11:00 AM",
      );
      expect(result).toEqual({
        title: "Appointment Rescheduled 🔁",
        body: "Buddy's appointment has been moved to 11:00 AM. Thanks for staying flexible!",
        type: "APPOINTMENTS",
      });
    });
  });

  // 2. Payment Notifications
  describe("Payment", () => {
    it("PAYMENT_PENDING: should return correct payload", () => {
      const result = NotificationTemplates.Payment.PAYMENT_PENDING(500, "INR");
      expect(result).toEqual({
        title: "Payment Pending 💳",
        body: "A quick reminder! You have a pending payment of 500 INR. Tap to complete it.",
        type: "PAYMENTS",
      });
    });

    it("PAYMENT_SUCCESS: should return correct payload", () => {
      const result = NotificationTemplates.Payment.PAYMENT_SUCCESS(500, "INR");
      expect(result).toEqual({
        title: "Payment Successful! 🥳",
        body: "Woohoo! Your payment of 500 INR went through. Thanks for taking great care of your companion!",
        type: "PAYMENTS",
      });
    });

    it("PAYMENT_FAILED: should return correct payload", () => {
      const result = NotificationTemplates.Payment.PAYMENT_FAILED();
      expect(result).toEqual({
        title: "Payment Failed ⚠️",
        body: "Oops! Something went wrong with your payment. Try again when you’re ready.",
        type: "PAYMENTS",
      });
    });

    it("REFUND_ISSUED: should return correct payload", () => {
      const result = NotificationTemplates.Payment.REFUND_ISSUED(200, "INR");
      expect(result).toEqual({
        title: "Refund Processed 💸",
        body: "A refund of 200 INR has been processed. Check your bank for updates.",
        type: "PAYMENTS",
      });
    });
  });

  // 3. Expense Notifications
  describe("Expense", () => {
    it("EXPENSE_ADDED: should return correct payload", () => {
      const result = NotificationTemplates.Expense.EXPENSE_ADDED(
        "Buddy",
        "Food",
      );
      expect(result).toEqual({
        title: "New Expense Added 📘",
        body: "You added a new food expense for Buddy.",
      });
    });

    it("EXPENSE_UPDATED: should return correct payload", () => {
      const result = NotificationTemplates.Expense.EXPENSE_UPDATED("Buddy");
      expect(result).toEqual({
        title: "Expense Updated ✏️",
        body: "An expense for Buddy has been updated.",
      });
    });
  });

  // 4. Care Notifications
  describe("Care", () => {
    it("VACCINE_REMINDER: should return correct payload", () => {
      const result = NotificationTemplates.Care.VACCINE_REMINDER("Buddy");
      expect(result).toEqual({
        title: "Vaccination Due 🩺",
        body: "Buddy is due for a vaccination. Staying protected is the best treat!",
      });
    });

    it("MEDICATION_REMINDER: should return correct payload", () => {
      const result = NotificationTemplates.Care.MEDICATION_REMINDER("Buddy");
      expect(result).toEqual({
        title: "Medication Reminder 💊",
        body: "Time for Buddy's meds. Healthy companions = happy parents!",
      });
    });
  });

  // 5. Auth Notifications
  describe("Auth", () => {
    it("OTP: should return correct payload", () => {
      const result = NotificationTemplates.Auth.OTP("123456");
      expect(result).toEqual({
        title: "Your OTP is Ready! 🔐",
        body: "Use this code to continue: 123456. It’s valid for the next 10 minutes!",
      });
    });
  });

  // 6. Task Notifications
  describe("Task", () => {
    it("TASK_ASSIGNED: should return correct payload", () => {
      const result = NotificationTemplates.Task.TASK_ASSIGNED(
        "Buddy",
        "Walking",
        "5:00 PM",
      );
      expect(result).toEqual({
        title: "New Task Assigned 🐾",
        body: "A new task for Buddy — \"Walking\" — is assigned to you. It's due by 5:00 PM. You've got this! 💪",
        type: "TASKS",
      });
    });

    it("TASK_DUE_REMINDER: should return correct payload", () => {
      const result = NotificationTemplates.Task.TASK_DUE_REMINDER(
        "Buddy",
        "Walking",
        "5:00 PM",
      );
      expect(result).toEqual({
        title: "Task Reminder ⏰",
        body: 'Just a friendly nudge — "Walking" for Buddy is due at 5:00 PM. Thanks for staying on top of things! 💚',
        type: "TASKS",
      });
    });

    it("TASK_COMPLETED: should return correct payload", () => {
      const result = NotificationTemplates.Task.TASK_COMPLETED(
        "Buddy",
        "Walking",
      );
      expect(result).toEqual({
        title: "Task Completed 🎉",
        body: 'Great job! You’ve marked "Walking" for Buddy as completed. Keep up the amazing work! 🐶✨',
        type: "TASKS",
      });
    });

    it("TASK_OVERDUE: should return correct payload", () => {
      const result = NotificationTemplates.Task.TASK_OVERDUE(
        "Buddy",
        "Walking",
      );
      expect(result).toEqual({
        title: "Task Overdue ⚠️",
        body: 'Looks like "Walking" for Buddy is now overdue. Don\'t worry — you can still complete it anytime.',
        type: "TASKS",
      });
    });
  });
});
