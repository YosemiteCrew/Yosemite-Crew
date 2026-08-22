export {};

const workerCtor = jest.fn();
const assertPublicHttpsUrl = jest.fn();
const findUniqueOrThrow = jest.fn();
const decryptPrivateKey = jest.fn();
const signRequest = jest.fn();
const axiosPost = jest.fn();
const loggerInfo = jest.fn();

jest.mock("bullmq", () => ({
  Worker: class {
    constructor(...args: unknown[]) {
      workerCtor(...args);
    }
  },
}));

jest.mock("src/queues/bull.config", () => ({
  defaultQueueOptions: { connection: { host: "127.0.0.1", port: 6379 } },
}));

jest.mock("src/utils/ap-url-guard", () => ({
  assertPublicHttpsUrl: (url: string) => assertPublicHttpsUrl(url),
}));

jest.mock("@yosemite-crew/database", () => ({
  prisma: {
    aPActor: {
      findUniqueOrThrow: (args: unknown) => findUniqueOrThrow(args),
    },
  },
}));

jest.mock("src/utils/http-signature", () => ({
  signRequest: (opts: unknown) => signRequest(opts),
}));

jest.mock("src/services/activitypub-crypto.service", () => ({
  decryptPrivateKey: (pem: string) => decryptPrivateKey(pem),
}));

jest.mock("src/utils/activitypub-builder", () => ({
  AP_CONTENT_TYPE: "application/activity+json",
}));

jest.mock("axios", () => ({
  __esModule: true,
  default: { post: (...args: unknown[]) => axiosPost(...args) },
}));

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { info: (...args: unknown[]) => loggerInfo(...args) },
}));

type Processor = (job: { data: unknown }) => Promise<unknown>;

function loadProcessor(): {
  processor: Processor;
  options: Record<string, unknown>;
} {
  const mod = require("src/workers/ap-delivery.worker");
  expect(mod.apDeliveryWorker).toBeDefined();
  const [name, processor, options] = workerCtor.mock.calls[0];
  expect(name).toBe("ap-delivery");
  return { processor, options };
}

const JOB_DATA = {
  actorId: "actor-1",
  inboxUri: "https://remote.example/inbox",
  activity: { type: "Follow", actor: "https://local.example/actor" },
};

describe("ap-delivery.worker", () => {
  beforeEach(() => {
    jest.resetModules();
    workerCtor.mockReset();
    assertPublicHttpsUrl.mockReset().mockResolvedValue(undefined);
    findUniqueOrThrow.mockReset().mockResolvedValue({
      id: "actor-1",
      privateKeyPem: "enc-pem",
      publicKeyId: "https://local.example/actor#main-key",
    });
    decryptPrivateKey.mockReset().mockReturnValue("decrypted-pem");
    signRequest
      .mockReset()
      .mockReturnValue({ Signature: "sig", Digest: "dig", Date: "date" });
    axiosPost.mockReset().mockResolvedValue({ status: 202 });
    loggerInfo.mockReset();
  });

  it("constructs the Worker with the ap-delivery name and concurrency 5", () => {
    const { options } = loadProcessor();
    expect(options).toMatchObject({
      connection: { host: "127.0.0.1", port: 6379 },
      concurrency: 5,
    });
  });

  it("processes a job: guards URL, signs, and POSTs the activity", async () => {
    const { processor } = loadProcessor();

    await processor({ data: JOB_DATA });

    expect(assertPublicHttpsUrl).toHaveBeenCalledWith(
      "https://remote.example/inbox",
    );
    expect(findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: "actor-1" },
    });
    expect(decryptPrivateKey).toHaveBeenCalledWith("enc-pem");
    expect(signRequest).toHaveBeenCalledWith({
      privateKeyPem: "decrypted-pem",
      keyId: "https://local.example/actor#main-key",
      method: "POST",
      url: "https://remote.example/inbox",
      body: JSON.stringify(JOB_DATA.activity),
    });

    const [url, body, config] = axiosPost.mock.calls[0];
    expect(url).toBe("https://remote.example/inbox");
    expect(body).toBe(JSON.stringify(JOB_DATA.activity));
    expect(config).toMatchObject({
      timeout: 15_000,
      maxRedirects: 0,
      headers: {
        "Content-Type": "application/activity+json",
        Accept: "application/activity+json",
        Signature: "sig",
        Digest: "dig",
        Date: "date",
      },
    });
    expect(loggerInfo).toHaveBeenCalledWith(
      "[AP delivery] Delivered activity",
      expect.objectContaining({
        actorId: "actor-1",
        inboxUri: "https://remote.example/inbox",
        type: "Follow",
      }),
    );
  });

  it("rejects (does not deliver) when the URL guard throws", async () => {
    const { processor } = loadProcessor();
    assertPublicHttpsUrl.mockRejectedValue(new Error("disallowed address"));

    await expect(processor({ data: JOB_DATA })).rejects.toThrow(
      "disallowed address",
    );

    expect(findUniqueOrThrow).not.toHaveBeenCalled();
    expect(axiosPost).not.toHaveBeenCalled();
    expect(loggerInfo).not.toHaveBeenCalled();
  });

  it("propagates the error when the remote inbox POST fails", async () => {
    const { processor } = loadProcessor();
    axiosPost.mockRejectedValue(new Error("502 Bad Gateway"));

    await expect(processor({ data: JOB_DATA })).rejects.toThrow(
      "502 Bad Gateway",
    );
    expect(loggerInfo).not.toHaveBeenCalled();
  });
});
