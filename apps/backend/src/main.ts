import "dotenv/config";
import { createApp } from "./app";
import { initQueues } from "./queues";
import { configureStreamUploadPolicy } from "./config/stream-upload-policy";
import { closePdfBrowser } from "./services/formPDF.service";
import logger from "./utils/logger";
import "./workers";

const PORT = process.env.PORT || 3000;

// The PDF renderer keeps one shared Chromium alive; close it before exiting so
// a pm2 restart never orphans the browser process. `once` keeps a second
// signal on its default terminate behaviour.
const shutdown = (signal: NodeJS.Signals) => {
  logger.info(`Received ${signal}, shutting down`);
  void closePdfBrowser().finally(() => process.exit(0));
};
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);

// NOSONAR – top-level await not supported in this runtime
async function startServer() {
  try {
    await initQueues();
    await configureStreamUploadPolicy();
    const app = createApp();

    app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
    });
  } catch (err) {
    logger.error("Failed to start server", err);
    process.exit(1);
  }
}

void startServer();
