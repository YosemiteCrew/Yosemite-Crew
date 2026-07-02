import { Worker } from "bullmq";
import { defaultQueueOptions } from "src/queues/bull.config";
import { ApInboxJobData } from "src/queues/ap-inbox.queue";
import {
  verifyInboundRequest,
  dispatchInboundActivity,
  AnyActivity,
} from "src/services/ap-inbox.service";
import logger from "src/utils/logger";

new Worker<ApInboxJobData>(
  "ap-inbox",
  async (job) => {
    const { targetOrgId, rawBody, headers, requestUrl, requestMethod } =
      job.data;

    const valid = await verifyInboundRequest({
      method: requestMethod,
      url: requestUrl,
      headers,
      body: rawBody,
    });

    if (!valid) {
      logger.warn("[AP inbox] Signature verification failed", {
        targetOrgId,
        keyId: headers["signature"]?.match(/keyId="([^"]+)"/)?.[1],
      });
      return;
    }

    let activity: AnyActivity;
    try {
      activity = JSON.parse(rawBody) as AnyActivity;
    } catch {
      logger.warn("[AP inbox] Invalid JSON body", { targetOrgId });
      return;
    }

    await dispatchInboundActivity(targetOrgId, activity);
  },
  {
    ...defaultQueueOptions,
    concurrency: 10,
  },
);
