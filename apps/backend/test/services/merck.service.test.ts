jest.mock("src/integrations/merck/merck.client", () => {
  const __searchMock = jest.fn();
  return {
    MerckHealthlinkClient: jest.fn().mockImplementation(() => ({
      search: __searchMock,
    })),
    __searchMock,
  };
});

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { MerckService } from "src/services/merck.service";
import logger from "src/utils/logger";

const mockedLogger = jest.mocked(logger);

describe("MerckService", () => {
  const originalEnv = process.env;
  const getSearchMock = () =>
    // jest.mock factory adds this field at runtime
    (jest.requireMock("src/integrations/merck/merck.client") as any)
      .__searchMock as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.MERCK_HEALTHLINK_BASE_URL_GLOBAL =
      "https://merckvetmanual.com/infobutton/searchjson";
    process.env.MERCK_HEALTHLINK_USERNAME = "test-user";
    process.env.MERCK_HEALTHLINK_PASSWORD = "test-pass";
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("does not leak Healthlink credentials when logging Axios search failures", async () => {
    const LEAK_USER = "LEAK_USER_123";
    const LEAK_PASS = "LEAK_PASS_456";

    const axiosError = Object.assign(new Error("boom"), {
      isAxiosError: true,
      code: "ECONNABORTED",
      config: {
        baseURL: "https://merckvetmanual.com/infobutton/searchjson",
        url: "/infobutton/searchjson?holder.assignedEntity.n=" + LEAK_USER,
        method: "get",
        timeout: 1000,
        params: {
          "holder.assignedEntity.n": LEAK_USER,
          "holder.assignedEntity.certificateText": LEAK_PASS,
        },
      },
      response: { status: 401 },
    });

    getSearchMock().mockRejectedValueOnce(axiosError);

    await expect(
      MerckService.searchConsumer({
        query: "canine diabetes",
        requestId: "req-1",
        timezone: "America/New_York",
      }),
    ).rejects.toBe(axiosError);

    expect(mockedLogger.error).toHaveBeenCalledWith(
      "Merck search failed",
      expect.any(Object),
    );

    const meta = mockedLogger.error.mock.calls[0]?.[1] as Record<
      string,
      unknown
    >;

    const serialized = JSON.stringify(meta);
    expect(serialized).not.toContain(LEAK_USER);
    expect(serialized).not.toContain(LEAK_PASS);
    expect(serialized).not.toContain("holder.assignedEntity");
  });
});
