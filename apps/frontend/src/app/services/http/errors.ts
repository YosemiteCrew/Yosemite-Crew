import axios from "axios";

export class HttpError extends Error {
  status?: number;
  code?: string;
  data?: unknown;

  constructor(message: string, opts?: { status?: number; code?: string; data?: unknown }) {
    super(message);
    this.name = "HttpError";
    this.status = opts?.status;
    this.code = opts?.code;
    this.data = opts?.data;
  }
}

export const isHttpError = (error: unknown): error is HttpError =>
  error instanceof HttpError;

const defaultMessage = "Request failed";

export const normalizeHttpError = (error: unknown): HttpError => {
  if (isHttpError(error)) return error;

  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const code = error.code;
    const data = error.response?.data;
    const message =
      error.message ||
      (typeof data === "string" ? data : defaultMessage);

    return new HttpError(message, { status, code, data });
  }

  if (error instanceof Error) {
    return new HttpError(error.message);
  }

  return new HttpError(defaultMessage);
};
