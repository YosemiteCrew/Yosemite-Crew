import { IdexxResultsClient } from "src/integrations/idexx/idexx-results.client";
import logger from "src/utils/logger";

const getEnv = (key: string): string | null => {
  const value = process.env[key];
  return value && value.trim() ? value : null;
};

const buildClient = () => {
  const username = getEnv("IDEXX_GLOBAL_USERNAME");
  const password = getEnv("IDEXX_GLOBAL_PASSWORD");
  const pimsId = getEnv("IDEXX_PIMS_ID");
  const pimsVersion = getEnv("IDEXX_PIMS_VERSION");

  if (!username || !password || !pimsId || !pimsVersion) {
    logger.warn("IDEXX results query skipped: missing env credentials.");
    return null;
  }

  return new IdexxResultsClient({
    username,
    password,
    pimsId,
    pimsVersion,
  });
};

export const IdexxResultsQueryService = {
  async getResult(resultId: string) {
    const client = buildClient();
    if (!client) return null;
    return client.getResult(resultId);
  },

  async getResultPdf(resultId: string) {
    const client = buildClient();
    if (!client) return null;
    return client.getResultPdf(resultId);
  },

  async getResultNotificationsPdf(resultId: string) {
    const client = buildClient();
    if (!client) return null;
    return client.getResultNotificationsPdf(resultId);
  },

  async search(params: Record<string, string | number | undefined>) {
    const client = buildClient();
    if (!client) return null;
    return client.searchResults(params);
  },
};
