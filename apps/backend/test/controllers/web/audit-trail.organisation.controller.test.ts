jest.mock("src/services/audit-trail.service", () => ({
  AuditTrailService: { listOrganisationFeed: jest.fn() },
  AuditTrailServiceError: class AuditTrailServiceError extends Error {
    constructor(
      message: string,
      public statusCode: number,
    ) {
      super(message);
    }
  },
}));
jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { AuditTrailController } from "src/controllers/web/audit-trail.controller";
import {
  AuditTrailService,
  AuditTrailServiceError,
} from "src/services/audit-trail.service";
import logger from "src/utils/logger";

const listFeed = AuditTrailService.listOrganisationFeed as jest.Mock;

const call = async (req: Record<string, unknown>) => {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  await AuditTrailController.listForOrganisation(req as never, res as never);
  return res;
};

describe("AuditTrailController.listForOrganisation", () => {
  beforeEach(() => jest.clearAllMocks());

  it("uses the organization from RBAC context and forwards paging parameters", async () => {
    const page = { entries: [], nextCursor: null };
    listFeed.mockResolvedValue(page);

    await expect(
      call({
        organisationId: "org-a",
        body: { limit: 12, cursor: "cursor" },
      }),
    ).resolves.toMatchObject({ statusCode: 200, body: page });
    expect(listFeed).toHaveBeenCalledWith({
      organisationId: "org-a",
      limit: 12,
      cursor: "cursor",
    });
  });

  it("accepts a string page size and defaults an omitted body", async () => {
    listFeed.mockResolvedValue({ entries: [], nextCursor: null });

    await call({ organisationId: "org-a", body: { limit: "12" } });
    expect(listFeed).toHaveBeenLastCalledWith({
      organisationId: "org-a",
      limit: 12,
      cursor: undefined,
    });

    await call({ organisationId: "org-a" });
    expect(listFeed).toHaveBeenLastCalledWith({
      organisationId: "org-a",
      limit: undefined,
      cursor: undefined,
    });
  });

  it.each([
    ["non-string cursor", { cursor: 2 }],
    ["malformed limit", { limit: "2rows" }],
    ["fractional limit", { limit: "12.8" }],
    ["non-positive limit", { limit: 0 }],
    ["organization override", { organisationId: "org-b" }],
  ])("rejects %s at the request boundary", async (_label, body) => {
    const response = await call({ organisationId: "org-a", body });
    expect(response.statusCode).toBe(400);
    expect(listFeed).not.toHaveBeenCalled();
  });

  it("requires an organization permission context", async () => {
    expect(await call({ body: {} })).toMatchObject({ statusCode: 400 });
    expect(listFeed).not.toHaveBeenCalled();
  });

  it("returns service errors with their status", async () => {
    listFeed.mockRejectedValueOnce(
      new AuditTrailServiceError("Invalid cursor", 400),
    );

    expect(
      await call({ organisationId: "org-a", body: { cursor: "bad" } }),
    ).toMatchObject({
      statusCode: 400,
      body: { message: "Invalid cursor" },
    });
  });

  it("reports unexpected failures as server errors", async () => {
    listFeed.mockRejectedValueOnce(new Error("database unavailable"));

    expect(await call({ organisationId: "org-a", body: {} })).toMatchObject({
      statusCode: 500,
      body: { message: "Unable to fetch audit trail." },
    });
    expect(logger.error).toHaveBeenCalled();
  });
});
