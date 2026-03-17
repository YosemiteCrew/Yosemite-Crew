import axios from "axios";

export type ExternalHttpError = {
  status: number;
  message: string;
  details?: unknown;
};

const extractMessage = (data: unknown): string | undefined => {
  if (!data) return undefined;
  if (typeof data === "string") return data;
  if (typeof data === "object") {
    const record = data as Record<string, unknown>;
    if (typeof record.message === "string") return record.message;
    if (typeof record.error === "string") return record.error;
    if (
      typeof record.error === "object" &&
      record.error &&
      typeof (record.error as Record<string, unknown>).message === "string"
    ) {
      return (record.error as Record<string, unknown>).message as string;
    }
    if (
      typeof record.error === "object" &&
      record.error &&
      typeof (record.error as Record<string, unknown>).code === "string"
    ) {
      return (record.error as Record<string, unknown>).code as string;
    }
  }
  return undefined;
};

export const mapAxiosError = (
  error: unknown,
  fallbackMessage: string,
): ExternalHttpError | null => {
  if (!axios.isAxiosError(error)) return null;

  const status = error.response?.status ?? 502;
  const details = error.response?.data;
  const detailMessage = extractMessage(details);

  return {
    status,
    message: detailMessage
      ? `${fallbackMessage}: ${detailMessage}`
      : fallbackMessage,
    details,
  };
};
