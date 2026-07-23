import type { Response } from "express";

const mockGetUserMetadata = jest.fn();
const mockGetAuthService = jest.fn();

jest.mock("@yosemite-crew/auth", () => ({
  getAuthService: mockGetAuthService,
}));

import { requireSuperAdmin } from "src/middlewares/super-admin";

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

describe("requireSuperAdmin", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects when auth is unavailable", async () => {
    mockGetAuthService.mockReturnValue(null);
    const res = createResponse();

    await requireSuperAdmin(
      { authSession: { appUserId: "user-1" } } as never,
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      message: "Authentication service is not enabled",
    });
  });

  it("rejects missing sessions", async () => {
    mockGetAuthService.mockReturnValue({
      getUserMetadata: mockGetUserMetadata,
    });
    const res = createResponse();

    await requireSuperAdmin({} as never, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: "Authentication required",
    });
  });

  it("rejects non-superadmin users", async () => {
    mockGetUserMetadata.mockResolvedValue({ role: "admin" });
    mockGetAuthService.mockReturnValue({
      getUserMetadata: mockGetUserMetadata,
    });
    const res = createResponse();

    await requireSuperAdmin(
      { authSession: { appUserId: "user-1" } } as never,
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: "Forbidden" });
  });

  it("allows superadmin users regardless of case", async () => {
    const next = jest.fn();
    mockGetUserMetadata.mockResolvedValue({ role: "SUPERADMIN" });
    mockGetAuthService.mockReturnValue({
      getUserMetadata: mockGetUserMetadata,
    });

    await requireSuperAdmin(
      { authSession: { appUserId: "user-1" } } as never,
      createResponse(),
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
  });
});
