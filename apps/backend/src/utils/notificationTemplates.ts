export type NotificationPayload = {
  title: string;
  body: string;
  type?: string;
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
      type: "APPOINTMENTS",
    }),

    APPROVED: (companionName: string, time: string): NotificationPayload => ({
      title: "Appointment Confirmed! 🎉",
      body: `Great news! ${companionName}'s appointment is confirmed for ${time}. See you soon!`,
      type: "APPOINTMENTS",
    }),

    CANCELLED: (companionName: string): NotificationPayload => ({
      title: "Appointment Cancelled ❌",
      body: `Your appointment for ${companionName} has been cancelled. We're here if you need to rebook.`,
      type: "APPOINTMENTS",
    }),

    REMINDER: (companionName: string, time: string): NotificationPayload => ({
      title: "Upcoming Appointment ⏰",
      body: `A little nudge! ${companionName} has an appointment at ${time}. Don’t forget!`,
      type: "APPOINTMENTS",
    }),

    RESCHEDULED: (
      companionName: string,
      newTime: string,
    ): NotificationPayload => ({
      title: "Appointment Rescheduled 🔁",
      body: `${companionName}'s appointment has been moved to ${newTime}. Thanks for staying flexible!`,
      type: "APPOINTMENTS",
    }),
  },

  //
  // -------------------------------------------------------
  // 💳 Invoice / Payment Notifications
  // -------------------------------------------------------
  //
  Payment: {
    PAYMENT_PENDING: (
      amount: number,
      currency: string,
    ): NotificationPayload => ({
      title: "Payment Pending 💳",
      body: `A quick reminder! You have a pending payment of ${amount} ${currency}. Tap to complete it.`,
      type: "PAYMENTS",
    }),

    PAYMENT_SUCCESS: (
      amount: number,
      currency: string,
    ): NotificationPayload => ({
      title: "Payment Successful! 🥳",
      body: `Woohoo! Your payment of ${amount} ${currency} went through. Thanks for taking great care of your companion!`,
      type: "PAYMENTS",
    }),

    PAYMENT_FAILED: (): NotificationPayload => ({
      title: "Payment Failed ⚠️",
      body: "Oops! Something went wrong with your payment. Try again when you’re ready.",
      type: "PAYMENTS",
    }),

    REFUND_ISSUED: (amount: number, currency: string): NotificationPayload => ({
      title: "Refund Processed 💸",
      body: `A refund of ${amount} ${currency} has been processed. Check your bank for updates.`,
      type: "PAYMENTS",
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
      category: string,
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

    PASSPORT_UPDATED: (companionName: string): NotificationPayload => ({
      title: "Passport updated 🪪",
      body: `${companionName}'s digital pet passport has a new verified record. Open it to view or add it to your wallet.`,
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

  Task: {
    TASK_ASSIGNED: (
      companionName: string,
      taskName: string,
      dueTime: string,
    ): NotificationPayload => ({
      title: "New Task Assigned 🐾",
      body: `A new task for ${companionName} — "${taskName}" — is assigned to you. It's due by ${dueTime}. You've got this! 💪`,
      type: "TASKS",
    }),

    TASK_DUE_REMINDER: (
      companionName: string,
      taskName: string,
      dueTime: string,
    ): NotificationPayload => ({
      title: "Task Reminder ⏰",
      body: `Just a friendly nudge — "${taskName}" for ${companionName} is due at ${dueTime}. Thanks for staying on top of things! 💚`,
      type: "TASKS",
    }),

    TASK_COMPLETED: (
      companionName: string,
      taskName: string,
    ): NotificationPayload => ({
      title: "Task Completed 🎉",
      body: `Great job! You’ve marked "${taskName}" for ${companionName} as completed. Keep up the amazing work! 🐶✨`,
      type: "TASKS",
    }),

    TASK_OVERDUE: (
      companionName: string,
      taskName: string,
    ): NotificationPayload => ({
      title: "Task Overdue ⚠️",
      body: `Looks like "${taskName}" for ${companionName} is now overdue. Don't worry — you can still complete it anytime.`,
      type: "TASKS",
    }),
  },
};
