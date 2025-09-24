import winston from "winston";
import { format } from "winston";
import type { TransformableInfo } from "logform";

const myFormat = format.printf((info: TransformableInfo) => {
  return `${info.timestamp} [${info.level}]: ${info.message}`;
});

export const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    myFormat
  ),
  transports: [
    new winston.transports.Console(),
  ],
});