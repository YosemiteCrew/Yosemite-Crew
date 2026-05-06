import type { Request } from "express";
import { resolveUserIdFromRequest } from "../../src/utils/request";

describe("resolveUserIdFromRequest", () => {
  it("returns authenticated userId when both auth userId and x-user-id header are present", () => {
    const req = {
      headers: { "x-user-id": "spoofed-user" },
      userId: "real-user",
    } as unknown as Request;

    expect(resolveUserIdFromRequest(req)).toBe("real-user");
  });

  it("falls back to x-user-id when authenticated userId is not set", () => {
    const req = {
      headers: { "x-user-id": "header-user" },
    } as unknown as Request;

    expect(resolveUserIdFromRequest(req)).toBe("header-user");
  });
});
