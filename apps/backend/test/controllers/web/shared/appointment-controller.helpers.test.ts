import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import type { Request, Response } from "express";
import {
  parseError,
  resolveAuthedParentId,
  sendAppointmentError,
} from "../../../../src/controllers/web/shared/appointment-controller.helpers";
import { AuthUserMobileService } from "../../../../src/services/authUserMobile.service";

jest.mock("../../../../src/services/authUserMobile.service");

const mockedAuthService = jest.mocked(AuthUserMobileService);

const buildRes = () => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res) as never;
  res.json = jest.fn().mockReturnValue(res) as never;
  return res as Response;
};

describe("parseError", () => {
  it("uses a numeric statusCode and the error message", () => {
    const err = Object.assign(new Error("Not found"), { statusCode: 404 });
    expect(parseError(err, "fallback")).toEqual({
      status: 404,
      message: "Not found",
    });
  });

  it("falls back to 500 when statusCode is missing or non-numeric", () => {
    expect(parseError(new Error("boom"), "fallback")).toEqual({
      status: 500,
      message: "boom",
    });
    const err = Object.assign(new Error("bad"), { statusCode: "418" });
    expect(parseError(err, "fallback")).toEqual({
      status: 500,
      message: "bad",
    });
  });

  it("falls back to the fallback message for non-Error values and empty messages", () => {
    expect(parseError("oops", "fallback")).toEqual({
      status: 500,
      message: "fallback",
    });
    expect(parseError(new Error(""), "fallback")).toEqual({
      status: 500,
      message: "fallback",
    });
    expect(parseError(null, "fallback")).toEqual({
      status: 500,
      message: "fallback",
    });
  });
});

describe("sendAppointmentError", () => {
  it("writes the parsed status and message to the response", () => {
    const res = buildRes();
    const err = Object.assign(new Error("Forbidden"), { statusCode: 403 });

    sendAppointmentError(res, err, "fallback");

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: "Forbidden" });
  });
});

describe("resolveAuthedParentId", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when the request carries no user id", async () => {
    const res = buildRes();
    const req = { headers: {} } as unknown as Request;

    const parentId = await resolveAuthedParentId(req, res);

    expect(parentId).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: "User not authenticated",
    });
    expect(mockedAuthService.getByProviderUserId).not.toHaveBeenCalled();
  });

  it("returns 400 when the user has no parent record", async () => {
    mockedAuthService.getByProviderUserId.mockResolvedValue(null as never);
    const res = buildRes();
    const req = { userId: "user_1", headers: {} } as unknown as Request;

    const parentId = await resolveAuthedParentId(req, res);

    expect(parentId).toBeUndefined();
    expect(mockedAuthService.getByProviderUserId).toHaveBeenCalledWith(
      "user_1",
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Parent information missing for user",
    });
  });

  it("returns the parent id as a string without touching the response", async () => {
    mockedAuthService.getByProviderUserId.mockResolvedValue({
      parentId: "parent_1",
    } as never);
    const res = buildRes();
    const req = { userId: "user_1", headers: {} } as unknown as Request;

    const parentId = await resolveAuthedParentId(req, res);

    expect(parentId).toBe("parent_1");
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
