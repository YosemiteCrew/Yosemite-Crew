import type { Request, Response } from "express";
import { TemplatePackController } from "../../src/controllers/web/template-pack.controller";
import {
  TemplatePackService,
  TemplatePackServiceError,
} from "../../src/services/template-pack.service";
import { resolveUserIdFromRequest } from "../../src/utils/request";

jest.mock("src/services/template-pack.service", () => {
  class TemplatePackServiceError extends Error {
    constructor(
      message: string,
      public readonly statusCode: number,
      public readonly code: string,
    ) {
      super(message);
      this.name = "TemplatePackServiceError";
    }
  }
  return {
    TemplatePackService: {
      create: jest.fn(),
      list: jest.fn(),
      publish: jest.fn(),
      catalog: jest.fn(),
      install: jest.fn(),
      uninstall: jest.fn(),
    },
    TemplatePackServiceError,
  };
});

jest.mock("src/utils/logger", () => ({ error: jest.fn(), info: jest.fn() }));

jest.mock("src/utils/request", () => ({
  resolveUserIdFromRequest: jest.fn(() => "user-1"),
}));

const mockService = TemplatePackService as unknown as Record<string, jest.Mock>;
const mockResolveUser = resolveUserIdFromRequest as jest.Mock;

type MockRes = Response & {
  status: jest.Mock;
  json: jest.Mock;
  send: jest.Mock;
};

const buildRes = (): MockRes => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
  return res as unknown as MockRes;
};

const buildReq = (input: {
  organisationId?: string;
  body?: unknown;
  query?: Record<string, unknown>;
  params?: Record<string, string>;
}): Request =>
  ({
    organisationId: input.organisationId,
    body: input.body ?? {},
    query: input.query ?? {},
    params: input.params ?? {},
  }) as unknown as Request;

const validBody = {
  name: "Dental Pack",
  slug: "dental-pack",
  description: "Dental templates",
  templateIds: ["tpl-1", "tpl-2"],
};

describe("TemplatePackController.createPack", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveUser.mockReturnValue("user-1");
  });

  it("400s without organisation context", async () => {
    const res = buildRes();
    await TemplatePackController.createPack(buildReq({ body: validBody }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockService.create).not.toHaveBeenCalled();
  });

  it("400s an invalid body", async () => {
    const res = buildRes();
    await TemplatePackController.createPack(
      buildReq({ organisationId: "org-1", body: { name: "x" } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("400s an invalid slug format", async () => {
    const res = buildRes();
    await TemplatePackController.createPack(
      buildReq({
        organisationId: "org-1",
        body: { ...validBody, slug: "Not A Slug!" },
      }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("400s duplicate templateIds", async () => {
    const res = buildRes();
    await TemplatePackController.createPack(
      buildReq({
        organisationId: "org-1",
        body: { ...validBody, templateIds: ["tpl-1", "tpl-1"] },
      }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Duplicate templateIds" }),
    );
  });

  it("201s the created pack", async () => {
    mockService.create.mockResolvedValue({ id: "pack-1" });
    const res = buildRes();
    await TemplatePackController.createPack(
      buildReq({ organisationId: "org-1", body: validBody }),
      res,
    );
    expect(mockService.create).toHaveBeenCalledWith({
      publisherOrganisationId: "org-1",
      name: "Dental Pack",
      slug: "dental-pack",
      description: "Dental templates",
      templateIds: ["tpl-1", "tpl-2"],
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ data: { id: "pack-1" } });
  });

  it("maps service errors to their status and code", async () => {
    mockService.create.mockRejectedValue(
      new TemplatePackServiceError("slug taken", 409, "slug_taken"),
    );
    const res = buildRes();
    await TemplatePackController.createPack(
      buildReq({ organisationId: "org-1", body: validBody }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "slug_taken" }),
    );
  });

  it("500s unexpected failures", async () => {
    mockService.create.mockRejectedValue(new Error("boom"));
    const res = buildRes();
    await TemplatePackController.createPack(
      buildReq({ organisationId: "org-1", body: validBody }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "internal_error" }),
    );
  });
});

describe("TemplatePackController.listPacks", () => {
  beforeEach(() => jest.clearAllMocks());

  it("lists the caller org's packs", async () => {
    mockService.list.mockResolvedValue([{ id: "pack-1" }]);
    const res = buildRes();
    await TemplatePackController.listPacks(
      buildReq({ organisationId: "org-1" }),
      res,
    );
    expect(mockService.list).toHaveBeenCalledWith("org-1");
    expect(res.json).toHaveBeenCalledWith({ data: [{ id: "pack-1" }] });
  });

  it("400s without organisation context", async () => {
    const res = buildRes();
    await TemplatePackController.listPacks(buildReq({}), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe("TemplatePackController.publishPack", () => {
  beforeEach(() => jest.clearAllMocks());

  it("publishes and returns the pack", async () => {
    mockService.publish.mockResolvedValue({
      id: "pack-1",
      status: "PUBLISHED",
    });
    const res = buildRes();
    await TemplatePackController.publishPack(
      buildReq({ organisationId: "org-1", params: { id: "pack-1" } }),
      res,
    );
    expect(mockService.publish).toHaveBeenCalledWith("org-1", "pack-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("maps not-found service errors", async () => {
    mockService.publish.mockRejectedValue(
      new TemplatePackServiceError("not found", 404, "not_found"),
    );
    const res = buildRes();
    await TemplatePackController.publishPack(
      buildReq({ organisationId: "org-1", params: { id: "pack-x" } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe("TemplatePackController.getCatalog", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns the published catalog with pagination", async () => {
    mockService.catalog.mockResolvedValue({
      items: [{ id: "pack-1" }],
      pagination: { nextCursor: null, hasMore: false, limit: 50 },
    });
    const res = buildRes();
    await TemplatePackController.getCatalog(buildReq({}), res);
    expect(mockService.catalog).toHaveBeenCalledWith({
      limit: 50,
      cursor: undefined,
    });
    expect(res.json).toHaveBeenCalledWith({
      data: [{ id: "pack-1" }],
      pagination: { nextCursor: null, hasMore: false, limit: 50 },
    });
  });

  it("clamps the limit and passes the cursor through", async () => {
    mockService.catalog.mockResolvedValue({
      items: [],
      pagination: { nextCursor: null, hasMore: false, limit: 100 },
    });
    await TemplatePackController.getCatalog(
      buildReq({ query: { limit: "500", cursor: "cur-1" } }),
      buildRes(),
    );
    expect(mockService.catalog).toHaveBeenCalledWith({
      limit: 100,
      cursor: "cur-1",
    });
  });

  it("400s malformed query params", async () => {
    const res = buildRes();
    await TemplatePackController.getCatalog(
      buildReq({ query: { limit: "abc" } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe("TemplatePackController.installPack", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveUser.mockReturnValue("user-1");
  });

  it("installs into the caller org and 201s the install record", async () => {
    mockService.install.mockResolvedValue({ id: "install-1" });
    const res = buildRes();
    await TemplatePackController.installPack(
      buildReq({ organisationId: "clinic-org", params: { id: "pack-1" } }),
      res,
    );
    expect(mockService.install).toHaveBeenCalledWith({
      packId: "pack-1",
      organisationId: "clinic-org",
      installedBy: "user-1",
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("400s without a resolvable user", async () => {
    mockResolveUser.mockReturnValue(undefined);
    const res = buildRes();
    await TemplatePackController.installPack(
      buildReq({ organisationId: "clinic-org", params: { id: "pack-1" } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockService.install).not.toHaveBeenCalled();
  });

  it("maps suspension to its service status", async () => {
    mockService.install.mockRejectedValue(
      new TemplatePackServiceError("suspended", 409, "pack_suspended"),
    );
    const res = buildRes();
    await TemplatePackController.installPack(
      buildReq({ organisationId: "clinic-org", params: { id: "pack-1" } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "pack_suspended" }),
    );
  });
});

describe("TemplatePackController.uninstallPack", () => {
  beforeEach(() => jest.clearAllMocks());

  it("204s a successful uninstall", async () => {
    mockService.uninstall.mockResolvedValue(undefined);
    const res = buildRes();
    await TemplatePackController.uninstallPack(
      buildReq({ organisationId: "clinic-org", params: { id: "pack-1" } }),
      res,
    );
    expect(mockService.uninstall).toHaveBeenCalledWith({
      packId: "pack-1",
      organisationId: "clinic-org",
    });
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
  });

  it("404s a missing install", async () => {
    mockService.uninstall.mockRejectedValue(
      new TemplatePackServiceError("not found", 404, "not_found"),
    );
    const res = buildRes();
    await TemplatePackController.uninstallPack(
      buildReq({ organisationId: "clinic-org", params: { id: "pack-1" } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
