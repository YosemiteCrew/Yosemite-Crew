import { registerDeveloperExportRecovery } from "../../src/queues/developer-export.scheduler";
import { DeveloperExportService } from "../../src/services/developer-export.service";
import logger from "../../src/utils/logger";

jest.mock("src/services/developer-export.service", () => ({
  DeveloperExportService: { recoverStaleJobs: jest.fn() },
}));

jest.mock("src/utils/logger", () => ({ info: jest.fn(), error: jest.fn() }));

const mockService = DeveloperExportService as unknown as {
  recoverStaleJobs: jest.Mock;
};
const mockLogger = logger as unknown as { info: jest.Mock };

describe("registerDeveloperExportRecovery", () => {
  beforeEach(() => jest.clearAllMocks());

  it("recovers stale pending export jobs once at boot", async () => {
    mockService.recoverStaleJobs.mockResolvedValue(2);

    await registerDeveloperExportRecovery();

    expect(mockService.recoverStaleJobs).toHaveBeenCalledTimes(1);
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining("Recovered 2 stale"),
    );
  });

  it("stays quiet when nothing was stale", async () => {
    mockService.recoverStaleJobs.mockResolvedValue(0);

    await registerDeveloperExportRecovery();

    const messages = mockLogger.info.mock.calls.map(
      ([message]: [string]) => message,
    );
    expect(messages.some((message) => message.includes("Recovered"))).toBe(
      false,
    );
  });
});
