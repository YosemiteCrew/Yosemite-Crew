import { Worker } from "bullmq";
import { defaultQueueOptions } from "src/queues/bull.config";
import { ApDeliveryJobData } from "src/queues/ap-delivery.queue";
import { prisma } from "@yosemite-crew/database";
import { signRequest } from "src/utils/http-signature";
import { decryptPrivateKey } from "src/services/activitypub-crypto.service";
import { AP_CONTENT_TYPE } from "src/utils/activitypub-builder";
import axios from "axios";
import logger from "src/utils/logger";

new Worker<ApDeliveryJobData>(
  "ap-delivery",
  async (job) => {
    const { actorId, inboxUri, activity } = job.data;

    const actor = await prisma.aPActor.findUniqueOrThrow({
      where: { id: actorId },
    });
    const body = JSON.stringify(activity);
    const privateKeyPem = decryptPrivateKey(actor.privateKeyPem);

    const signedHeaders = signRequest({
      privateKeyPem,
      keyId: actor.publicKeyId,
      method: "POST",
      url: inboxUri,
      body,
    });

    await axios.post(inboxUri, body, {
      headers: {
        "Content-Type": AP_CONTENT_TYPE,
        Accept: AP_CONTENT_TYPE,
        ...signedHeaders,
      },
      timeout: 15_000,
    });

    logger.info("[AP delivery] Delivered activity", {
      actorId,
      inboxUri,
      type: (activity as { type?: string }).type,
    });
  },
  {
    ...defaultQueueOptions,
    concurrency: 5,
  },
);
