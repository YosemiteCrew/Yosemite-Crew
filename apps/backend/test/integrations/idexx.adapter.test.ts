import { IdexxAdapter } from "src/integrations/idexx/idexx.adapter";
import { IdexxClient } from "src/integrations/idexx/idexx.client";

jest.mock("src/integrations/idexx/idexx.client", () => ({
  IdexxClient: jest.fn(),
}));

describe("IdexxAdapter", () => {
  const mockIdexxClient = IdexxClient as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.IDEXX_PIMS_ID = "pims-id";
    process.env.IDEXX_PIMS_VERSION = "pims-version";
  });

  it("returns error when credentials are missing", async () => {
    const adapter = new IdexxAdapter();
    const result = await adapter.validateCredentials({} as any);
    expect(result).toEqual({ ok: false, reason: "Missing credentials." });
  });

  it("returns error for invalid credentials payload", async () => {
    const adapter = new IdexxAdapter();
    const result = await adapter.validateCredentials({ username: 123 } as any);
    expect(result).toEqual({
      ok: false,
      reason: "Invalid IDEXX credentials payload.",
    });
  });

  it("returns error when username is blank", async () => {
    const adapter = new IdexxAdapter();
    const result = await adapter.validateCredentials({
      username: " ",
      password: "pass",
    } as any);
    expect(result).toEqual({ ok: false, reason: "username is required." });
  });

  it("returns error when password is blank", async () => {
    const adapter = new IdexxAdapter();
    const result = await adapter.validateCredentials({
      username: "user",
      password: "",
    } as any);
    expect(result).toEqual({ ok: false, reason: "password is required." });
  });

  it("returns error when IDEXX_PIMS_ID is missing", async () => {
    process.env.IDEXX_PIMS_ID = "";
    const adapter = new IdexxAdapter();
    const result = await adapter.validateCredentials({
      username: "user",
      password: "pass",
    } as any);
    expect(result).toEqual({
      ok: false,
      reason: "IDEXX_PIMS_ID is not configured.",
    });
  });

  it("returns error when IDEXX_PIMS_VERSION is missing", async () => {
    process.env.IDEXX_PIMS_VERSION = " ";
    const adapter = new IdexxAdapter();
    const result = await adapter.validateCredentials({
      username: "user",
      password: "pass",
    } as any);
    expect(result).toEqual({
      ok: false,
      reason: "IDEXX_PIMS_VERSION is not configured.",
    });
  });

  it("validates credentials successfully", async () => {
    const validateCredentials = jest.fn().mockResolvedValue(undefined);
    mockIdexxClient.mockImplementation(() => ({ validateCredentials }) as any);

    const adapter = new IdexxAdapter();
    const result = await adapter.validateCredentials({
      username: "user",
      password: "pass",
      labAccountId: "lab-1",
    } as any);

    expect(result).toEqual({ ok: true });
    expect(mockIdexxClient).toHaveBeenCalledWith({
      username: "user",
      password: "pass",
      labAccountId: "lab-1",
      pimsId: "pims-id",
      pimsVersion: "pims-version",
    });
    expect(validateCredentials).toHaveBeenCalled();
  });

  it("returns error when client validation fails", async () => {
    const validateCredentials = jest
      .fn()
      .mockRejectedValue(new Error("invalid credentials"));
    mockIdexxClient.mockImplementation(() => ({ validateCredentials }) as any);

    const adapter = new IdexxAdapter();
    const result = await adapter.validateCredentials({
      username: "user",
      password: "pass",
    } as any);

    expect(result).toEqual({
      ok: false,
      reason: "invalid credentials",
    });
  });
});
