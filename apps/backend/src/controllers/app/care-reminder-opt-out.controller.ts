import {
  CareReminderOptOutConfigError,
  InvalidCareReminderOptOutTokenError,
  readCareReminderOptOutToken,
  unsubscribeFromCareReminders,
} from "src/services/care-reminder-opt-out.service";
import { escapeHtml } from "src/utils/email-templates";
import {
  createUnsubscribeController,
  unsubscribePage,
} from "./shared/unsubscribe-controller";

const confirmPage = (token: string) =>
  unsubscribePage(
    "Stop care reminders",
    `<h1>Stop receiving care reminders?</h1>
<p>This stops care reminders from this practice only. Reminders from any other practice that cares for your companion are unaffected, and your appointment confirmations still apply.</p>
<form method="POST">
  <input type="hidden" name="token" value="${escapeHtml(token)}" />
  <button type="submit">Yes, stop these reminders</button>
</form>`,
  );

const successPage = unsubscribePage(
  "Reminders stopped",
  `<h1>You have been unsubscribed</h1>
<p>You will no longer receive care reminders from this practice. Reminders from any other practice that cares for your companion are unaffected, and your appointment confirmations still apply.</p>`,
);

export const CareReminderOptOutController = createUnsubscribeController({
  readToken: readCareReminderOptOutToken,
  unsubscribe: unsubscribeFromCareReminders,
  InvalidTokenError: InvalidCareReminderOptOutTokenError,
  ConfigError: CareReminderOptOutConfigError,
  configErrorMessage: "Care reminder opt-out configuration is invalid.",
  failureMessage: "Failed to record care reminder opt-out.",
  confirmPage,
  successPage,
});
