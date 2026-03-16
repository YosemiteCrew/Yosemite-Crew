import logger from "src/utils/logger";

if (process.env.USE_INMEMORY_DB !== "true") {
  Promise.all([
    import("./taskReminder.worker"),
    import("./taskRecurrence.worker"),
    import("./appointment.worker"),
    import("./idexx-reference.worker"),
    import("./lab-status.worker"),
    import("./lab-results.worker"),
  ]).then(() => {
    logger.info("👷 BullMQ workers running...");
  }).catch((err) => {
    logger.error("Failed to load BullMQ workers", err);
  });
} else {
  logger.info("👷 Skipping BullMQ workers (in-memory mode)");
}
