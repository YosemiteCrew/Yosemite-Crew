export type NotificationPayload = {
  title: string;
  body: string;
};

export const NotificationTemplates = {
  //
  // -------------------------------------------------------
  // 🐾 Appointment Notifications
  // -------------------------------------------------------
  //
  Appointment: {
    REQUESTED: (companionName: string, time: string): NotificationPayload => ({
      title: "Appointment Request Sent! 🐾",
      body: `${companionName} is all set! Your appointment request for ${time} has been sent to the clinic.`,
    }),

    APPROVED: (companionName: string, time: string): NotificationPayload => ({
      title: "Appointment Confirmed! 🎉",
      body: `Great news! ${companionName}'s appointment is confirmed for ${time}. See you soon!`,
    }),

    CANCELLED: (companionName: string): NotificationPayload => ({
      title: "Appointment Cancelled ❌",
      body: `Your appointment for ${companionName} has been cancelled. We're here if you need to rebook.`,
    }),

    REMINDER: (companionName: string, time: string): NotificationPayload => ({
      title: "Upcoming Appointment ⏰",
      body: `A little nudge! ${companionName} has an appointment at ${time}. Don’t forget!`,
    }),

    RESCHEDULED: (
      companionName: string,
      newTime: string
    ): NotificationPayload => ({
      title: "Appointment Rescheduled 🔁",
      body: `${companionName}'s appointment has been moved to ${newTime}. Thanks for staying flexible!`,
    }),
  },

  //
  // -------------------------------------------------------
  // 💳 Invoice / Payment Notifications
  // -------------------------------------------------------
  //
  Payment: {
    PAYMENT_PENDING: (amount: number): NotificationPayload => ({
      title: "Payment Pending 💳",
      body: `A quick reminder! You have a pending payment of ₹${amount}. Tap to complete it.`,
    }),

    PAYMENT_SUCCESS: (amount: number): NotificationPayload => ({
      title: "Payment Successful! 🥳",
      body: `Woohoo! Your payment of ₹${amount} went through. Thanks for taking great care of your companion!`,
    }),

    PAYMENT_FAILED: (): NotificationPayload => ({
      title: "Payment Failed ⚠️",
      body: "Oops! Something went wrong with your payment. Try again when you’re ready.",
    }),

    REFUND_ISSUED: (amount: number): NotificationPayload => ({
      title: "Refund Processed 💸",
      body: `A refund of ₹${amount} has been processed. Check your bank for updates.`,
    }),
  },

  //
  // -------------------------------------------------------
  // 📘 Expense Notifications (External & In-App)
  // -------------------------------------------------------
  //
  Expense: {
    EXPENSE_ADDED: (
      companionName: string,
      category: string
    ): NotificationPayload => ({
      title: "New Expense Added 📘",
      body: `You added a new ${category.toLowerCase()} expense for ${companionName}.`,
    }),

    EXPENSE_UPDATED: (companionName: string): NotificationPayload => ({
      title: "Expense Updated ✏️",
      body: `An expense for ${companionName} has been updated.`,
    }),
  },

  //
  // -------------------------------------------------------
  // 🩺 Health & Care Reminders
  // -------------------------------------------------------
  //
  Care: {
    VACCINE_REMINDER: (companionName: string): NotificationPayload => ({
      title: "Vaccination Due 🩺",
      body: `${companionName} is due for a vaccination. Staying protected is the best treat!`,
    }),

    MEDICATION_REMINDER: (companionName: string): NotificationPayload => ({
      title: "Medication Reminder 💊",
      body: `Time for ${companionName}'s meds. Healthy companions = happy parents!`,
    }),
  },

  //
  // -------------------------------------------------------
  // 🔐 Authentication (Login, OTP, etc.)
  // -------------------------------------------------------
  //
  Auth: {
    OTP: (otp: string): NotificationPayload => ({
      title: "Your OTP is Ready! 🔐",
      body: `Use this code to continue: ${otp}. It’s valid for the next 10 minutes!`,
    }),
  },
};