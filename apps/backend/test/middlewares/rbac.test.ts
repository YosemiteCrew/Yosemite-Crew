import { describe, it, expect, jest } from "@jest/globals";
import type { NextFunction, Request, Response } from "express";
import type { Permission } from "../../src/models/role-permission";
import { requirePermission, type OrgRequest } from "../../src/middlewares/rbac";

const mockRes = (): Response =>
  ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  }) as unknown as Response;

describe("rbac requirePermission", () => {
  it("returns 500 if permissions not loaded", () => {
    const middleware = requirePermission("tasks:view:any");
    const req = {} as Request;
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });

  it("allows a single permission match", () => {
    const middleware = requirePermission("tasks:view:any");
    const req = {
      userPermissions: ["tasks:view:any"],
    } as unknown as OrgRequest;
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    middleware(req as unknown as Request, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("treats arrays as any-of (OR)", () => {
    const middleware = requirePermission([
      "tasks:edit:any",
      "tasks:edit:own",
    ] as Permission[]);
    const req = {
      userPermissions: ["tasks:edit:own"],
    } as unknown as OrgRequest;
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    middleware(req as unknown as Request, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("returns 403 when no required permissions are present", () => {
    const middleware = requirePermission([
      "tasks:edit:any",
      "tasks:edit:own",
    ] as Permission[]);
    const req = {
      userPermissions: ["tasks:view:any"],
    } as unknown as OrgRequest;
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    middleware(req as unknown as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
