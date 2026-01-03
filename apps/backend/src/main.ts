import { createApp } from "./app";
import { connectDB } from "./config/db";
import { initQueues } from "./queues";
import logger from "./utils/logger";
import "./workers";

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await connectDB();
    await initQueues();
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
