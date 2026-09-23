import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { NextFunction, Request, Response } from "express";

import { requireActiveAccount } from "../../src/middlewares/require-active-account";
import { prisma } from "../../src/config/prisma";

jest.mock("../../src/config/prisma", () => ({
  prisma: { user: { findFirst: jest.fn() } },
}));

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const mockPrisma = prisma as unknown as {
  user: { findFirst: jest.Mock<() => Promise<unknown>> };
};

const buildRes = () => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return { res: { status, json } as unknown as Response, status, json };
};

describe("requireActiveAccount", () => {
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    next = jest.fn() as unknown as NextFunction;
  });

  const run = (userId: unknown, res: Response) =>
    requireActiveAccount()({ userId } as unknown as Request, res, next);

  it("passes an active account through", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ isActive: true });
    const { res, status } = buildRes();

    await run("user-1", res);

    expect(next).toHaveBeenCalled();
    expect(status).not.toHaveBeenCalled();
  });

  it("refuses a soft-deleted account", async () => {
    // deleteById sets isActive:false and cannot revoke the provider session, so
    // the session stays valid and would otherwise reach these routes.
    mockPrisma.user.findFirst.mockResolvedValue({ isActive: false });
    const { res, status, json } = buildRes();

    await run("user-gone", res);

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ error: "Unauthorized" });
  });

  it("refuses an account whose row no longer exists", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const { res, status } = buildRes();

    await run("user-gone", res);

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(401);
  });

  it("refuses a request with no authenticated user", async () => {
    const { res, status } = buildRes();

    await run(undefined, res);

    expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(401);
  });

  it("answers 500 when the account lookup fails", async () => {
    mockPrisma.user.findFirst.mockRejectedValue(new Error("db down"));
    const { res, status } = buildRes();

    await run("user-1", res);

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(500);
  });
});
