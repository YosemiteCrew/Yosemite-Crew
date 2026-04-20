import axios from "axios";

type SafeAxiosErrorLog = {
  kind: "axios";
  message: string;
  code: string | null;
  status: number | null;
  method: string | null;
  baseURL: string | null;
  url: string | null;
  timeoutMs: number | null;
};

type SafeErrorLog =
  | SafeAxiosErrorLog
  | { kind: "error"; name: string; message: string }
  | { kind: "unknown"; value: string };

const stripQueryString = (value: string | undefined | null) => {
  if (!value) return null;
  const idx = value.indexOf("?");
  return idx >= 0 ? value.slice(0, idx) : value;
};

export const toSafeErrorLog = (error: unknown): SafeErrorLog => {
  if (axios.isAxiosError(error)) {
    const cfg = error.config;
    return {
      kind: "axios",
      message: error.message,
      code: error.code ?? null,
      status: error.response?.status ?? null,
      method: (cfg?.method ?? null) ? String(cfg?.method) : null,
      baseURL: (cfg?.baseURL ?? null) ? String(cfg?.baseURL) : null,
      url: stripQueryString((cfg?.url ?? null) ? String(cfg?.url) : null),
      timeoutMs:
        typeof cfg?.timeout === "number" && Number.isFinite(cfg.timeout)
          ? cfg.timeout
          : null,
    };
  }

  if (error instanceof Error) {
    return { kind: "error", name: error.name, message: error.message };
  }

  return { kind: "unknown", value: String(error) };
};
