export {};

const workerCtor = jest.fn();
const verifyInboundRequest = jest.fn();
const dispatchInboundActivity = jest.fn();
const loggerWarn = jest.fn();

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

jest.mock("src/services/ap-inbox.service", () => ({
  verifyInboundRequest: (opts: unknown) => verifyInboundRequest(opts),
  dispatchInboundActivity: (orgId: string, activity: unknown) =>
    dispatchInboundActivity(orgId, activity),
}));

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { warn: (...args: unknown[]) => loggerWarn(...args) },
}));

type Processor = (job: { data: unknown }) => Promise<unknown>;

function loadProcessor(): {
  processor: Processor;
  options: Record<string, unknown>;
} {
  const mod = require("src/workers/ap-inbox.worker");
  expect(mod.apInboxWorker).toBeDefined();
  const [name, processor, options] = workerCtor.mock.calls[0];
  expect(name).toBe("ap-inbox");
  return { processor, options };
}

const SIGNER = "https://remote.example/actor";
const ACTIVITY = { type: "Follow", actor: SIGNER };

function jobData(overrides: Record<string, unknown> = {}) {
  return {
    targetOrgId: "org-1",
    rawBody: JSON.stringify(ACTIVITY),
    headers: { signature: `keyId="${SIGNER}#main-key",algorithm="rsa-sha256"` },
    requestUrl: "https://local.example/inbox",
    requestMethod: "POST",
    ...overrides,
  };
}

describe("ap-inbox.worker", () => {
  beforeEach(() => {
    jest.resetModules();
    workerCtor.mockReset();
    verifyInboundRequest
      .mockReset()
      .mockResolvedValue({ ok: true, signerUri: SIGNER });
    dispatchInboundActivity.mockReset().mockResolvedValue(undefined);
    loggerWarn.mockReset();
  });

  it("constructs the Worker with the ap-inbox name and concurrency 10", () => {
    const { options } = loadProcessor();
    expect(options).toMatchObject({
      connection: { host: "127.0.0.1", port: 6379 },
      concurrency: 10,
    });
  });

  it("verifies, parses, and dispatches a valid inbound activity", async () => {
    const { processor } = loadProcessor();

    await processor({ data: jobData() });

    expect(verifyInboundRequest).toHaveBeenCalledWith({
      method: "POST",
      url: "https://local.example/inbox",
      headers: {
        signature: `keyId="${SIGNER}#main-key",algorithm="rsa-sha256"`,
      },
      body: JSON.stringify(ACTIVITY),
    });
    expect(dispatchInboundActivity).toHaveBeenCalledWith("org-1", ACTIVITY);
    expect(loggerWarn).not.toHaveBeenCalled();
  });

  it("drops and warns (with extracted keyId) when signature verification fails", async () => {
    const { processor } = loadProcessor();
    verifyInboundRequest.mockResolvedValue({ ok: false });

    await processor({ data: jobData() });

    expect(dispatchInboundActivity).not.toHaveBeenCalled();
    expect(loggerWarn).toHaveBeenCalledWith(
      "[AP inbox] Signature verification failed",
      { targetOrgId: "org-1", keyId: `${SIGNER}#main-key` },
    );
  });

  it("drops with undefined keyId when verification fails and no signature header present", async () => {
    const { processor } = loadProcessor();
    verifyInboundRequest.mockResolvedValue({ ok: false });

    await processor({ data: jobData({ headers: {} }) });

    expect(loggerWarn).toHaveBeenCalledWith(
      "[AP inbox] Signature verification failed",
      { targetOrgId: "org-1", keyId: undefined },
    );
  });

  it("drops and warns on invalid JSON body", async () => {
    const { processor } = loadProcessor();

    await processor({ data: jobData({ rawBody: "{not-json" }) });

    expect(dispatchInboundActivity).not.toHaveBeenCalled();
    expect(loggerWarn).toHaveBeenCalledWith("[AP inbox] Invalid JSON body", {
      targetOrgId: "org-1",
    });
  });

  it("drops when the activity actor does not match the request signer (impersonation)", async () => {
    const { processor } = loadProcessor();
    const spoofed = { type: "Follow", actor: "https://evil.example/actor" };

    await processor({ data: jobData({ rawBody: JSON.stringify(spoofed) }) });

    expect(dispatchInboundActivity).not.toHaveBeenCalled();
    expect(loggerWarn).toHaveBeenCalledWith(
      "[AP inbox] Actor does not match request signer — dropping",
      expect.objectContaining({
        targetOrgId: "org-1",
        activityActor: "https://evil.example/actor",
        signerUri: SIGNER,
      }),
    );
  });
});
