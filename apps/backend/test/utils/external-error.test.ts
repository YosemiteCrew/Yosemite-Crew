import axios from "axios";
import { mapAxiosError } from "../../src/utils/external-error";

jest.mock("axios");

const mockAxios = axios as jest.Mocked<typeof axios>;

describe("mapAxiosError", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns null for non-axios errors", () => {
    mockAxios.isAxiosError.mockReturnValue(false);
    expect(mapAxiosError(new Error("no"), "fallback")).toBeNull();
  });

  it("uses fallback status and message when no details", () => {
    mockAxios.isAxiosError.mockReturnValue(true);
    const error = { response: {} };
    expect(mapAxiosError(error, "fallback")).toEqual({
      status: 502,
      message: "fallback",
      details: undefined,
    });
  });

  it("extracts detail message from response data", () => {
    mockAxios.isAxiosError.mockReturnValue(true);
    const error = { response: { status: 400, data: { message: "Bad" } } };
    expect(mapAxiosError(error, "fallback")).toEqual({
      status: 400,
      message: "fallback: Bad",
      details: { message: "Bad" },
    });
  });

  it("extracts nested error messages", () => {
    mockAxios.isAxiosError.mockReturnValue(true);
    const error = {
      response: { status: 500, data: { error: { message: "Oops" } } },
    };
    expect(mapAxiosError(error, "fallback")).toEqual({
      status: 500,
      message: "fallback: Oops",
      details: { error: { message: "Oops" } },
    });
  });

  it("extracts error code when available", () => {
    mockAxios.isAxiosError.mockReturnValue(true);
    const error = {
      response: { status: 401, data: { error: { code: "AUTH" } } },
    };
    expect(mapAxiosError(error, "fallback")).toEqual({
      status: 401,
      message: "fallback: AUTH",
      details: { error: { code: "AUTH" } },
    });
  });

  it("extracts error string fields", () => {
    mockAxios.isAxiosError.mockReturnValue(true);
    const error = {
      response: { status: 403, data: { error: "Denied" } },
    };
    expect(mapAxiosError(error, "fallback")).toEqual({
      status: 403,
      message: "fallback: Denied",
      details: { error: "Denied" },
    });
  });

  it("extracts string body directly", () => {
    mockAxios.isAxiosError.mockReturnValue(true);
    const error = {
      response: { status: 404, data: "Not Found" },
    };
    expect(mapAxiosError(error, "fallback")).toEqual({
      status: 404,
      message: "fallback: Not Found",
      details: "Not Found",
    });
  });
});
