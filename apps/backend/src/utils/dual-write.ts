import logger from "./logger";

export const shouldDualWrite = process.env.DUAL_WRITE_ENABLED === "true";
export const isDualWriteStrict = process.env.DUAL_WRITE_STRICT === "true";

export const handleDualWriteError = (entity: string, err: unknown) => {
  logger.error(`${entity} dual-write failed: ${String(err)}`);
  if (isDualWriteStrict) {
    throw err;
  }
};
