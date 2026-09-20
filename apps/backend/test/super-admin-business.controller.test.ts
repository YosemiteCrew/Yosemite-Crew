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
  it("returns the members payload", async () => {
    jest
      .spyOn(SuperAdminBusinessService, "listBusinessMembers")
      .mockResolvedValue([
        {
          userId: "user-1",
          roleCode: "doctor",
          since: "2026-07-01T09:00:00.000Z",
        },
      ]);
    const res = createResponse();

    await SuperAdminBusinessController.listMembers(
      { params: { id: "org-1" } } as never,
      res,
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      members: [
        {
          userId: "user-1",
          roleCode: "doctor",
          since: "2026-07-01T09:00:00.000Z",
        },
      ],
    });
  });

  it("rejects malformed ids on members", async () => {
    const listMembers = jest.spyOn(
      SuperAdminBusinessService,
      "listBusinessMembers",
    );
    const res = createResponse();

    await SuperAdminBusinessController.listMembers(
      { params: { id: "bad id" } } as never,
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(listMembers).not.toHaveBeenCalled();
  });

  it("separates an unknown business from one with no members", async () => {
    // null is 404; an empty roster is a 200 with an empty array. Collapsing the
    // two would show "this clinic has nobody in it" for a mistyped id.
    jest
      .spyOn(SuperAdminBusinessService, "listBusinessMembers")
      .mockResolvedValue(null);
    const notFound = createResponse();

    await SuperAdminBusinessController.listMembers(
      { params: { id: "org-1" } } as never,
      notFound,
    );

    expect(notFound.status).toHaveBeenCalledWith(404);
    expect(notFound.json).toHaveBeenCalledWith({
      error: "Business not found",
      code: "BUSINESS_NOT_FOUND",
    });

    jest
      .spyOn(SuperAdminBusinessService, "listBusinessMembers")
      .mockResolvedValue([]);
    const empty = createResponse();

    await SuperAdminBusinessController.listMembers(
      { params: { id: "org-1" } } as never,
      empty,
    );

    expect(empty.status).toHaveBeenCalledWith(200);
    expect(empty.json).toHaveBeenCalledWith({ members: [] });
  });

  it("maps a service error on members to its stable payload", async () => {
    jest
      .spyOn(SuperAdminBusinessService, "listBusinessMembers")
      .mockRejectedValue(
        new SuperAdminBusinessServiceError(
          "Invalid business id.",
          400,
          "INVALID_BUSINESS_ID",
        ),
      );
    const res = createResponse();

    await SuperAdminBusinessController.listMembers(
      { params: { id: "org-1" } } as never,
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid business id.",
      code: "INVALID_BUSINESS_ID",
    });
  });

  it("does not leak an unexpected failure as an empty roster", async () => {
    jest
      .spyOn(SuperAdminBusinessService, "listBusinessMembers")
      .mockRejectedValue(new Error("connection refused"));
    const res = createResponse();

    await SuperAdminBusinessController.listMembers(
      { params: { id: "org-1" } } as never,
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to list business members.",
      code: "SUPER_ADMIN_BUSINESS_MEMBERS_FAILED",
    });
  });
});
