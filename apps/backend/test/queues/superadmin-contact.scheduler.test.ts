import { SuperadminContactQueue } from "../../src/queues/superadmin-contact.queue";
import { registerSuperadminContactScheduler } from "../../src/queues/superadmin-contact.scheduler";
import { SuperadminContactService } from "src/services/superadmin-contact.service";

jest.mock("../../src/queues/superadmin-contact.queue", () => ({
  SuperadminContactQueue: {
    upsertJobScheduler: jest.fn(),
  },
  SuperadminContactJobs: { DRAIN_FORWARDS: "DRAIN_FORWARDS" },
}));

jest.mock("src/services/superadmin-contact.service", () => ({
  SuperadminContactService: {
    warnIfUnconfigured: jest.fn(),
  },
}));

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn() },
}));

describe("registerSuperadminContactScheduler", () => {
  beforeEach(() => jest.clearAllMocks());

  it("registers the drain every 60 seconds", async () => {
    await registerSuperadminContactScheduler();

    // The period and the batch size together are the mirror's rate. Slowing
    // this tick down without shrinking the batch is what would push the mirror
    // over the panel's limit.
    expect(SuperadminContactQueue.upsertJobScheduler).toHaveBeenCalledWith(
      "superadmin-contact-forward-repeat",
      { every: 60 * 1000 },
      { name: "DRAIN_FORWARDS", data: {} },
    );
  });

  it("reports an unconfigured mirror once at startup", async () => {
    await registerSuperadminContactScheduler();

    expect(SuperadminContactService.warnIfUnconfigured).toHaveBeenCalledTimes(
      1,
    );
  });
});
