import type { Response } from "express";
import { SuperAdminBusinessController } from "src/controllers/web/super-admin-business.controller";
import {
  SuperAdminBusinessService,
  SuperAdminBusinessServiceError,
} from "src/services/super-admin-business.service";

const createResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  } as unknown as Response & {
    status: jest.Mock;
    json: jest.Mock;
  };

  return res;
};

describe("SuperAdminBusinessController", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("returns a list payload", async () => {
    jest
      .spyOn(SuperAdminBusinessService, "listBusinesses")
      .mockResolvedValue([{ id: "org-1" } as never]);
    const res = createResponse();

    await SuperAdminBusinessController.listBusinesses({} as never, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      businesses: [{ id: "org-1" }],
    });
  });

  it("rejects malformed ids on get", async () => {
    const res = createResponse();

    await SuperAdminBusinessController.getBusiness(
      { params: { id: "bad id" } } as never,
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid business id format.",
      code: "INVALID_BUSINESS_ID",
    });
  });

  it("returns not found when the service misses", async () => {
    jest
      .spyOn(SuperAdminBusinessService, "getBusiness")
      .mockResolvedValue(null);
    const res = createResponse();

    await SuperAdminBusinessController.getBusiness(
      { params: { id: "org-1" } } as never,
      res,
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: "Business not found",
      code: "BUSINESS_NOT_FOUND",
    });
  });

  it("returns the updated business payload", async () => {
    jest.spyOn(SuperAdminBusinessService, "updateBusiness").mockResolvedValue({
      id: "org-1",
    } as never);
    const res = createResponse();

    await SuperAdminBusinessController.updateBusiness(
      { params: { id: "org-1" }, body: { isActive: false } } as never,
      res,
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      business: { id: "org-1" },
    });
  });

  it("maps service errors to stable error payloads", async () => {
    jest
      .spyOn(SuperAdminBusinessService, "updateBusiness")
      .mockRejectedValue(
        new SuperAdminBusinessServiceError(
          "At least one status field is required.",
          400,
          "INVALID_BUSINESS_UPDATE",
        ),
      );
    const res = createResponse();

    await SuperAdminBusinessController.updateBusiness(
      { params: { id: "org-1" }, body: { isActive: false } } as never,
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "At least one status field is required.",
      code: "INVALID_BUSINESS_UPDATE",
    });
  });

  it("rejects invalid update bodies", async () => {
    const res = createResponse();

    await SuperAdminBusinessController.updateBusiness(
      { params: { id: "org-1" }, body: {} } as never,
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Exactly one status field is required.",
      code: "INVALID_BUSINESS_UPDATE",
    });
  });
});
