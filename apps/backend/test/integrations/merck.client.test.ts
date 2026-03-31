import axios from "axios";
import { MerckHealthlinkClient } from "src/integrations/merck/merck.client";

jest.mock("axios");

const mockAxios = axios as jest.Mocked<typeof axios>;

describe("MerckHealthlinkClient", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("trims trailing question marks from baseUrl", () => {
    mockAxios.create.mockReturnValue({} as any);

    new MerckHealthlinkClient({
      baseUrl: "https://merck.local???",
      username: "user",
      password: "pass",
      timeoutMs: 5000,
    });

    expect(mockAxios.create).toHaveBeenCalledWith({
      baseURL: "https://merck.local",
      timeout: 5000,
    });
  });

  it("search returns normalized response data", async () => {
    const http = {
      get: jest.fn().mockResolvedValue({
        data: { ok: true },
        headers: { "content-type": " text/xml " },
        status: 200,
        request: { res: { responseUrl: "https://merck.local/final" } },
      }),
    };
    mockAxios.create.mockReturnValue(http as any);

    const client = new MerckHealthlinkClient({
      baseUrl: "https://merck.local",
      username: "user",
      password: "pass",
      timeoutMs: 5000,
    });

    await expect(
      client.search({ q: "a" }, { Authorization: "Bearer token" }),
    ).resolves.toEqual({
      data: JSON.stringify({ ok: true }),
      contentType: "text/xml",
      status: 200,
      finalUrl: "https://merck.local/final",
    });

    expect(http.get).toHaveBeenCalledWith("", {
      params: { q: "a" },
      headers: { Authorization: "Bearer token" },
      responseType: "text",
    });
  });

  it("search handles string responses and missing content type", async () => {
    const http = {
      get: jest.fn().mockResolvedValue({
        data: "plain text",
        headers: {},
        status: 201,
        request: {},
      }),
    };
    mockAxios.create.mockReturnValue(http as any);

    const client = new MerckHealthlinkClient({
      baseUrl: "https://merck.local",
      username: "user",
      password: "pass",
      timeoutMs: 5000,
    });

    await expect(client.search({})).resolves.toEqual({
      data: "plain text",
      contentType: null,
      status: 201,
      finalUrl: null,
    });
  });
});
