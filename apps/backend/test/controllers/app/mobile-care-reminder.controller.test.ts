const listDueCareRemindersForParent = jest.fn();
const getByProviderUserId = jest.fn();
const resolveVerifiedUserId = jest.fn();
const loggerError = jest.fn();

jest.mock("src/services/mobile-care-reminder.service", () => {
  const actual = jest.requireActual(
    "src/services/mobile-care-reminder.service",
  );
  return {
    ...actual,
    MobileCareReminderService: { listDueCareRemindersForParent },
  };
});

jest.mock("src/services/authUserMobile.service", () => ({
  AuthUserMobileService: { getByProviderUserId },
}));

jest.mock("src/utils/request", () => ({ resolveVerifiedUserId }));

jest.mock("src/utils/logger", () => ({ error: loggerError, warn: jest.fn() }));

import type { Request, Response } from "express";
import { MobileCareReminderController } from "src/controllers/app/care-reminder.controller";
import { encodeCareReminderCursor } from "src/services/mobile-care-reminder.service";

type MockResponse = { status: jest.Mock; json: jest.Mock };

const response = () => {
  const res = {} as MockResponse;
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const asRes = (r: MockResponse) => r as unknown as Response;
const asReq = (query: Record<string, unknown> = {}) =>
  ({ query }) as unknown as Request;

const page = (overrides: Record<string, unknown> = {}) => ({
  reminders: [],
  nextCursor: null,
  hasMore: false,
  limit: 20,
  ...overrides,
});

const CURSOR_UUID = "11111111-2222-4333-8444-555555555555";

describe("MobileCareReminderController.listDueReminders", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveVerifiedUserId.mockReturnValue("provider-1");
    getByProviderUserId.mockResolvedValue({ parentId: "parent-1" });
    listDueCareRemindersForParent.mockResolvedValue(page());
  });

  it("answers 401 for an unauthenticated caller and never reaches the service", async () => {
    resolveVerifiedUserId.mockReturnValue(undefined);
    const res = response();

    await MobileCareReminderController.listDueReminders(asReq(), asRes(res));

    expect(res.status).toHaveBeenCalledWith(401);
    expect(listDueCareRemindersForParent).not.toHaveBeenCalled();
  });

  it("answers 404 when the session has no parent behind it", async () => {
    getByProviderUserId.mockResolvedValue(null);
    const res = response();

    await MobileCareReminderController.listDueReminders(asReq(), asRes(res));

    expect(res.status).toHaveBeenCalledWith(404);
    expect(listDueCareRemindersForParent).not.toHaveBeenCalled();
  });

  it("answers 400 for a malformed cursor instead of letting the query decide", async () => {
    const res = response();

    await MobileCareReminderController.listDueReminders(
      asReq({ cursor: "nonsense" }),
      asRes(res),
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(listDueCareRemindersForParent).not.toHaveBeenCalled();
  });

  it("does not echo the rejected cursor, which is caller-controlled text", async () => {
    const res = response();

    await MobileCareReminderController.listDueReminders(
      asReq({ cursor: "nonsense\r\nforged: line" }),
      asRes(res),
    );

    const body = JSON.stringify(res.json.mock.calls[0][0]);
    expect(body).not.toContain("forged");
    expect(loggerError).not.toHaveBeenCalled();
  });

  it("passes an absent cursor through as undefined, not as a rejection", async () => {
    const res = response();

    await MobileCareReminderController.listDueReminders(asReq(), asRes(res));

    expect(res.status).toHaveBeenCalledWith(200);
    expect(listDueCareRemindersForParent).toHaveBeenCalledWith("parent-1", {
      limit: undefined,
      cursor: undefined,
    });
  });

  it("decodes a usable cursor into a due date and an id", async () => {
    const dueDate = new Date("2026-09-11T00:00:00.000Z");
    const res = response();

    await MobileCareReminderController.listDueReminders(
      asReq({
        cursor: encodeCareReminderCursor({ dueDate, id: CURSOR_UUID }),
        limit: "5",
      }),
      asRes(res),
    );

    expect(listDueCareRemindersForParent).toHaveBeenCalledWith("parent-1", {
      limit: "5",
      cursor: { dueDate, id: CURSOR_UUID },
    });
  });

  it("returns the paging fields beside the list, so a short page is not mistaken for the end", async () => {
    listDueCareRemindersForParent.mockResolvedValue(
      page({
        reminders: [{ id: "rem-1", overdue: true }],
        nextCursor: "cursor-2",
        hasMore: true,
        limit: 1,
      }),
    );
    const res = response();

    await MobileCareReminderController.listDueReminders(asReq(), asRes(res));

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      reminders: [{ id: "rem-1", overdue: true }],
      nextCursor: "cursor-2",
      hasMore: true,
      limit: 1,
    });
  });

  it("answers 500 when the query itself fails, without leaking the error to the caller", async () => {
    listDueCareRemindersForParent.mockRejectedValue(
      new Error("connection to 10.0.0.4 refused"),
    );
    const res = response();

    await MobileCareReminderController.listDueReminders(asReq(), asRes(res));

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Failed to list care reminders.",
    });
    expect(loggerError).toHaveBeenCalled();
  });
});
