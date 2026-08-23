import {
  InvalidMarketingUnsubscribeTokenError,
  MarketingUnsubscribeConfigError,
  readMarketingUnsubscribeToken,
  unsubscribeMarketingEmail,
} from "src/services/marketing-unsubscribe.service";
import { escapeHtml } from "src/utils/email-templates";
import {
  createUnsubscribeController,
  unsubscribePage,
} from "./shared/unsubscribe-controller";

const confirmPage = (token: string) =>
  unsubscribePage(
    "Unsubscribe",
    `<h1>Unsubscribe from marketing emails?</h1>
<p>This stops marketing emails. Transactional messages about your account, such as appointment confirmations, are unaffected.</p>
<form method="POST">
  <input type="hidden" name="token" value="${escapeHtml(token)}" />
  <button type="submit">Yes, unsubscribe me</button>
</form>`,
  );

const successPage = unsubscribePage(
  "Unsubscribed",
  `<h1>You have been unsubscribed</h1>
<p>You will no longer receive marketing emails from us. Transactional messages about your account are unaffected.</p>`,
);

export const MarketingUnsubscribeController = createUnsubscribeController({
  readToken: readMarketingUnsubscribeToken,
  unsubscribe: unsubscribeMarketingEmail,
  InvalidTokenError: InvalidMarketingUnsubscribeTokenError,
  ConfigError: MarketingUnsubscribeConfigError,
  configErrorMessage: "Marketing unsubscribe configuration is invalid.",
  failureMessage: "Failed to unsubscribe SES marketing contact.",
  confirmPage,
  successPage,
});
