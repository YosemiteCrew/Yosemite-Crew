type LogLevel = "debug" | "info" | "warn" | "error";

const isProd = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test";

const prefix = (level: LogLevel) => `[${level.toUpperCase()}]`;

const safeArgs = (args: unknown[]) => args.length ? args : ["(no details)"];

export const logger = {
  debug: (...args: unknown[]) => {
    if (isProd || isTest) return;
    console.debug(prefix("debug"), ...safeArgs(args));
  },
  info: (...args: unknown[]) => {
    if (isProd || isTest) return;
    console.info(prefix("info"), ...safeArgs(args));
  },
  warn: (...args: unknown[]) => {
    if (isTest) return;
    console.warn(prefix("warn"), ...safeArgs(args));
  },
  error: (...args: unknown[]) => {
    if (isTest) return;
    console.error(prefix("error"), ...safeArgs(args));
  },
};
