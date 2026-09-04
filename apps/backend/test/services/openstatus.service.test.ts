import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import axios from "axios";
import {
  OpenStatusService,
  OpenStatusMonitorEvent,
} from "../../src/services/openstatus.service";

jest.mock("axios");

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

const BASE_URL = "https://api.openstatus.dev/v1";

const failureEvent: OpenStatusMonitorEvent = {
  monitor: { id: 42, name: "API", url: "https://api.example.com" },
  cronTimestamp: 1_700_000_000,
  status: "error",
  statusCode: 503,
  errorMessage: "Service Unavailable",
};

const recoveryEvent: OpenStatusMonitorEvent = {
  monitor: { id: 42, name: "API", url: "https://api.example.com" },
  cronTimestamp: 1_700_000_100,
  status: "recovered",
  statusCode: 200,
};

describe("OpenStatusService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OPENSTATUS_API_KEY = "test-key";
    process.env.OPENSTATUS_PAGE_ID = "7";
    delete process.env.OPENSTATUS_API_BASE_URL;
  });

  it("creates a status report when no incident is open for the monitor", async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: [] });
    mockedAxios.post.mockResolvedValueOnce({ data: { id: 99 } });

    const result = await OpenStatusService.handleMonitorEvent(failureEvent);

    expect(result).toEqual({ created: true });
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    const [url, body, config] = mockedAxios.post.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/status_report`);
    expect(body).toMatchObject({
      title: "API outage",
      status: "investigating",
      monitorIds: [42],
      pageId: 7,
    });
    expect((body as { message: string }).message).toContain("HTTP 503");
    expect(
      (config as { headers: Record<string, string> }).headers[
        "x-openstatus-key"
      ],
    ).toBe("test-key");
  });

  it("uses a degraded title when the monitor is degraded", async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: [] });
    mockedAxios.post.mockResolvedValueOnce({ data: { id: 1 } });

    await OpenStatusService.handleMonitorEvent({
      ...failureEvent,
      status: "degraded",
    });

    const [, body] = mockedAxios.post.mock.calls[0];
    expect((body as { title: string }).title).toBe("API degraded performance");
  });

  it("does not create a duplicate report when one is already open", async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: [{ id: 5, status: "investigating", monitorIds: [42], pageId: 7 }],
    });

    const result = await OpenStatusService.handleMonitorEvent(failureEvent);

    expect(result).toEqual({ created: false });
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("resolves open reports for the monitor on recovery", async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: [
        { id: 5, status: "investigating", monitorIds: [42], pageId: 7 },
        { id: 6, status: "resolved", monitorIds: [42], pageId: 7 },
        { id: 7, status: "monitoring", monitorIds: [99], pageId: 7 },
      ],
    });
    mockedAxios.post.mockResolvedValue({ data: {} });

    const result = await OpenStatusService.handleMonitorEvent(recoveryEvent);

    expect(result).toEqual({ resolved: 1 });
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    const [url, body] = mockedAxios.post.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/status_report/5/update`);
    expect(body).toMatchObject({ status: "resolved" });
  });

  it("is a no-op on recovery when there is no open report", async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: [] });

    const result = await OpenStatusService.handleMonitorEvent(recoveryEvent);

    expect(result).toEqual({ resolved: 0 });
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("honours OPENSTATUS_API_BASE_URL override", async () => {
    process.env.OPENSTATUS_API_BASE_URL = "https://self-hosted.example.com/v1";
    mockedAxios.get.mockResolvedValueOnce({ data: [] });
    mockedAxios.post.mockResolvedValueOnce({ data: { id: 1 } });

    await OpenStatusService.handleMonitorEvent(failureEvent);

    const [url] = mockedAxios.post.mock.calls[0];
    expect(url).toBe("https://self-hosted.example.com/v1/status_report");
  });

  it("treats a non-array list response as empty and opens an incident", async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: null });
    mockedAxios.post.mockResolvedValueOnce({ data: { id: 1 } });

    const result = await OpenStatusService.handleMonitorEvent(failureEvent);

    expect(result).toEqual({ created: true });
  });

  it("ignores reports without monitorIds when matching a monitor", async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: [{ id: 8, status: "investigating", pageId: 7 }],
    });
    mockedAxios.post.mockResolvedValueOnce({ data: { id: 9 } });

    const result = await OpenStatusService.handleMonitorEvent(failureEvent);

    expect(result).toEqual({ created: true });
  });

  it("throws when OPENSTATUS_API_KEY is missing", async () => {
    delete process.env.OPENSTATUS_API_KEY;

    await expect(
      OpenStatusService.handleMonitorEvent(failureEvent),
    ).rejects.toThrow("OPENSTATUS_API_KEY is not set");
  });

  it("throws when OPENSTATUS_PAGE_ID is missing while creating a report", async () => {
    delete process.env.OPENSTATUS_PAGE_ID;
    mockedAxios.get.mockResolvedValueOnce({ data: [] });

    await expect(
      OpenStatusService.handleMonitorEvent(failureEvent),
    ).rejects.toThrow("OPENSTATUS_PAGE_ID is not set or is not a number");
  });
});
