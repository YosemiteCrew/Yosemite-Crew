import logger from "src/utils/logger";
import { recordControl } from "./startup-controls";

const CONTROL_NAME = "auth-account-linking";
const FEATURE_PATH = "/ee/featureflag";
const PROBE_TIMEOUT_MS = 5_000;

const firstCoreUri = (): string | null => {
  const uri = process.env.SUPERTOKENS_CONNECTION_URI?.split(";")[0]?.trim();
  return uri || null;
};

export const configureAuthAccountLinkingControl = async (
  authEnabled: boolean,
): Promise<void> => {
  if (!authEnabled) {
    recordControl(CONTROL_NAME, "skipped", "authentication not enabled");
    return;
  }

  const coreUri = firstCoreUri();
  if (!coreUri) {
    recordControl(CONTROL_NAME, "failed", "core feature probe unavailable");
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const apiKey = process.env.SUPERTOKENS_API_KEY;
    const response = await fetch(
      `${coreUri.replace(/\/$/, "")}${FEATURE_PATH}`,
      {
        headers: apiKey ? { "api-key": apiKey } : undefined,
        signal: controller.signal,
      },
    );
    if (!response.ok) throw new Error("feature probe rejected");

    const body: unknown = await response.json();
    if (
      !body ||
      typeof body !== "object" ||
      !("features" in body) ||
      !Array.isArray(body.features) ||
      !body.features.every((feature) => typeof feature === "string")
    ) {
      throw new Error("feature probe returned an invalid body");
    }

    const enabled =
      body.features.includes("account_linking") ||
      body.features.includes("mfa");
    recordControl(
      CONTROL_NAME,
      enabled ? "applied" : "failed",
      enabled ? undefined : "core does not enable account linking",
    );
  } catch (error) {
    logger.error("Could not read auth core features", error);
    recordControl(CONTROL_NAME, "failed", "core feature probe unavailable");
  } finally {
    clearTimeout(timeout);
  }
};

export const isAccountLinkingUnavailableError = (error: unknown): boolean =>
  error instanceof Error &&
  error.message.includes("/recipe/accountlinking/") &&
  /\b402\b/.test(error.message);
