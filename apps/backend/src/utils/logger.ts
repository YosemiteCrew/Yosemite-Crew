import winston from "winston";
import dotenv from "dotenv";
import safeStringify from "safe-stable-stringify";

dotenv.config();

const { combine, timestamp, printf, colorize, json, errors } = winston.format;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const serializeLogMessage = (value: unknown): string => {
  if (typeof value === "string") return value;

  if (value instanceof Error) {
    return value.stack ?? value.message;
  }

  try {
    return safeStringify(value)!;
  } catch {
    return String(value);
  }
};

const serializeMeta = (meta: Record<string, unknown>): string => {
  if (Object.keys(meta).length === 0) return "";

  // avoid exploding your logs with huge objects
  const cleanedMeta = { ...meta };

  // Common circular / noisy fields - remove or reduce them safely
  if ("req" in cleanedMeta) cleanedMeta.req = "[Request]";
  if ("res" in cleanedMeta) cleanedMeta.res = "[Response]";
  if ("request" in cleanedMeta) cleanedMeta.request = "[Request]";
  if ("response" in cleanedMeta) cleanedMeta.response = "[Response]";

  return ` ${safeStringify(cleanedMeta, null, 2)}`;
};

const logFormat = printf(({ level, message, timestamp: time, stack, ...meta }) => {
  const safeTimestamp = isNonEmptyString(time) ? time : new Date().toISOString();
  const metaRecord = meta as Record<string, unknown>;

  const renderedMessage = isNonEmptyString(stack)
    ? stack
    : serializeLogMessage(message);

  const serializedMeta = serializeMeta(metaRecord);

  return `${safeTimestamp} [${level}]: ${renderedMessage}${serializedMeta}`;
});

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const colors = {
  error: "red",
  warn: "yellow",
  info: "green",
  debug: "white",
};

winston.addColors(colors);

const useJsonFormat = process.env.NODE_ENV !== "development";

const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  levels,
  format: useJsonFormat
    ? combine(
        errors({ stack: true }),
        timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        json(),
      )
    : combine(
        errors({ stack: true }),
        colorize({ all: true }),
        timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        logFormat,
      ),
  transports: [new winston.transports.Console()],
});

type LogMethod = (message: string, ...meta: unknown[]) => void;

interface Logger {
  error: LogMethod;
  warn: LogMethod;
  info: LogMethod;
  debug: LogMethod;
}

export default logger as Logger;
