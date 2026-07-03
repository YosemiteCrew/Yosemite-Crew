import { Worker } from "bullmq";
import { defaultQueueOptions } from "src/queues/bull.config";
import { ApInboxJobData } from "src/queues/ap-inbox.queue";
import {
  verifyInboundRequest,
  dispatchInboundActivity,
  AnyActivity,
} from "src/services/ap-inbox.service";
import logger from "src/utils/logger";

const KEY_ID_RE = /keyId="([^"]+)"/;

export const apInboxWorker = new Worker<ApInboxJobData>(
  "ap-inbox",
  async (job) => {
    const { targetOrgId, rawBody, headers, requestUrl, requestMethod } =
      job.data;

    const { ok, signerUri } = await verifyInboundRequest({
      method: requestMethod,
      url: requestUrl,
      headers,
      body: rawBody,
    });

    if (!ok) {
      const signatureHeader = headers["signature"];
      const keyId = signatureHeader
        ? KEY_ID_RE.exec(signatureHeader)?.[1]
        : undefined;
      logger.warn("[AP inbox] Signature verification failed", {
        targetOrgId,
        keyId,
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

    // The signing actor must be the activity's actor — block impersonation.
    if (activity.actor !== signerUri) {
      logger.warn("[AP inbox] Actor does not match request signer — dropping", {
        targetOrgId,
        activityActor: activity.actor,
        signerUri,
      });
      return;
    }

    await dispatchInboundActivity(targetOrgId, activity);
  },
  {
    ...defaultQueueOptions,
    concurrency: 10,
  },
);
