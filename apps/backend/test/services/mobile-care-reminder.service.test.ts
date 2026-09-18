import {
  DEFAULT_CARE_REMINDER_PAGE_SIZE,
  MAX_CARE_REMINDER_PAGE_SIZE,
  MobileCareReminderService,
  encodeCareReminderCursor,
  parseCareReminderCursor,
} from "../../src/services/mobile-care-reminder.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    parentPatient: { findMany: jest.fn() },
    careReminder: { findMany: jest.fn() },
    careReminderOptOut: { findMany: jest.fn() },
    patient: { findMany: jest.fn() },
  },
}));

import { prisma } from "src/config/prisma";

const mockLinks = prisma.parentPatient.findMany as jest.Mock;
const mockReminders = prisma.careReminder.findMany as jest.Mock;
const mockOptOuts = prisma.careReminderOptOut.findMany as jest.Mock;
const mockPatients = prisma.patient.findMany as jest.Mock;

const { listDueCareRemindersForParent } = MobileCareReminderService;

/**
 * A CO_PARENT by default, because `medicalRecords` is the flag that actually
 * constrains that role. Building these as PRIMARY would make every permission
 * assertion below vacuous - a primary link passes on its role alone.
 */
const activeLink = (patientId: string, medicalRecords = true) => ({
  patientId,
  role: "CO_PARENT",
  permissions: { medicalRecords },
});

const NOW = new Date("2026-09-18T12:00:00.000Z");
const CURSOR_UUID = "11111111-2222-4333-8444-555555555555";

const reminderRow = (overrides: Record<string, unknown> = {}) => ({
  id: "rem-1",
  patientId: "pet-1",
  organisationId: "org-1",
  reminderType: "VACCINATION_BOOSTER",
  customMessage: null,
  dueDate: new Date("2026-09-10T00:00:00.000Z"),
  status: "PENDING",
  sentAt: null,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockLinks.mockResolvedValue([activeLink("pet-1")]);
  mockReminders.mockResolvedValue([]);
  mockPatients.mockResolvedValue([{ id: "pet-1", name: "Bruno" }]);
  mockOptOuts.mockResolvedValue([]);
});

describe("scoping", () => {
  it("never queries reminders when the parent has no permitted companions", async () => {
    mockLinks.mockResolvedValue([activeLink("pet-1", false)]);

    const page = await listDueCareRemindersForParent("parent-1");

    expect(page.reminders).toEqual([]);
    expect(page.hasMore).toBe(false);
    expect(mockReminders).not.toHaveBeenCalled();
  });

  it("scopes the query to the permitted patients only", async () => {
    mockLinks.mockResolvedValue([
      activeLink("pet-1"),
      activeLink("pet-2", false),
      activeLink("pet-3"),
    ]);

    await listDueCareRemindersForParent("parent-1");

    expect(mockReminders.mock.calls[0][0].where.patientId).toEqual({
      in: ["pet-1", "pet-3"],
    });
  });

  it("asks only for open reminders, so responded and cancelled ones cannot appear", async () => {
    await listDueCareRemindersForParent("parent-1");

    const { status } = mockReminders.mock.calls[0][0].where;
    expect(status).toEqual({ in: ["PENDING", "SENT"] });
    expect(status.in).not.toContain("RESPONDED");
    expect(status.in).not.toContain("CANCELLED");
    expect(status.in).not.toContain("EXPIRED");
  });

  it("does not read the opt-out list: objecting to contact must not hide the item in-app", async () => {
    mockReminders.mockResolvedValue([reminderRow()]);

    const page = await listDueCareRemindersForParent("parent-1");

    expect(page.reminders).toHaveLength(1);
    expect(mockOptOuts).not.toHaveBeenCalled();
  });

  it("never selects the practice's own working fields", async () => {
    await listDueCareRemindersForParent("parent-1");

    const { select } = mockReminders.mock.calls[0][0];
    expect(select.notes).toBeUndefined();
    expect(select.createdBy).toBeUndefined();
    // The control: the select is not empty, so the two assertions above are
    // about what was excluded rather than about a select that asks for nothing.
    expect(select.dueDate).toBe(true);
  });
});

describe("due and overdue", () => {
  it("orders by the reminder's own schedule, soonest first, with an id tiebreak", async () => {
    await listDueCareRemindersForParent("parent-1");

    expect(mockReminders.mock.calls[0][0].orderBy).toEqual([
      { dueDate: "asc" },
      { id: "asc" },
    ]);
  });

  it("marks a reminder whose due date has passed as overdue", async () => {
    mockReminders.mockResolvedValue([
      reminderRow({ dueDate: new Date("2026-09-17T23:59:59.999Z") }),
    ]);

    const page = await listDueCareRemindersForParent("parent-1", { now: NOW });

    expect(page.reminders[0].overdue).toBe(true);
  });

  it("does not mark a reminder due exactly now as overdue", async () => {
    mockReminders.mockResolvedValue([reminderRow({ dueDate: NOW })]);

    const page = await listDueCareRemindersForParent("parent-1", { now: NOW });

    expect(page.reminders[0].overdue).toBe(false);
  });

  it("does not mark a future reminder as overdue", async () => {
    mockReminders.mockResolvedValue([
      reminderRow({ dueDate: new Date("2026-09-18T12:00:00.001Z") }),
    ]);

    const page = await listDueCareRemindersForParent("parent-1", { now: NOW });

    expect(page.reminders[0].overdue).toBe(false);
  });

  it("draws overdue from the due date and not from whether a notification went out", async () => {
    mockReminders.mockResolvedValue([
      reminderRow({
        id: "never-delivered",
        status: "PENDING",
        sentAt: null,
        dueDate: new Date("2026-09-01T00:00:00.000Z"),
      }),
      reminderRow({
        id: "delivered",
        status: "SENT",
        sentAt: new Date("2026-09-19T00:00:00.000Z"),
        dueDate: new Date("2026-09-30T00:00:00.000Z"),
      }),
    ]);

    const page = await listDueCareRemindersForParent("parent-1", { now: NOW });

    expect(page.reminders.map((r) => [r.id, r.overdue])).toEqual([
      ["never-delivered", true],
      ["delivered", false],
    ]);
  });

  it("uses one instant for the whole page, so two rows cannot disagree about the time", async () => {
    mockReminders.mockResolvedValue([
      reminderRow({ id: "a", dueDate: NOW }),
      reminderRow({ id: "b", dueDate: NOW }),
    ]);

    const page = await listDueCareRemindersForParent("parent-1", { now: NOW });

    expect(page.reminders.map((r) => r.overdue)).toEqual([false, false]);
  });
});

describe("what the owner is told", () => {
  it("returns the practice's own wording when there is one", async () => {
    mockReminders.mockResolvedValue([
      reminderRow({
        customMessage: "Bruno's booster is due at the Elm Street practice.",
      }),
    ]);

    const page = await listDueCareRemindersForParent("parent-1", { now: NOW });

    expect(page.reminders[0].message).toBe(
      "Bruno's booster is due at the Elm Street practice.",
    );
  });

  it("composes the same sentence the notification carried when there is none", async () => {
    mockReminders.mockResolvedValue([
      reminderRow({ reminderType: "DENTAL_CLEANING" }),
    ]);

    const page = await listDueCareRemindersForParent("parent-1", { now: NOW });

    expect(page.reminders[0].message).toBe(
      "Bruno is due for a dental cleaning. Please book an appointment at your earliest convenience.",
    );
  });

  it("maps the companion name onto its own reminders", async () => {
    mockLinks.mockResolvedValue([activeLink("pet-1"), activeLink("pet-2")]);
    mockPatients.mockResolvedValue([
      { id: "pet-1", name: "Bruno" },
      { id: "pet-2", name: "Nala" },
    ]);
    mockReminders.mockResolvedValue([
      reminderRow({ id: "r1", patientId: "pet-2" }),
      reminderRow({ id: "r2", patientId: "pet-1" }),
    ]);

    const page = await listDueCareRemindersForParent("parent-1", { now: NOW });

    expect(page.reminders.map((r) => r.patientName)).toEqual(["Nala", "Bruno"]);
  });

  it("asks for each companion once even when it has several reminders", async () => {
    mockReminders.mockResolvedValue([
      reminderRow({ id: "r1" }),
      reminderRow({ id: "r2" }),
    ]);

    await listDueCareRemindersForParent("parent-1", { now: NOW });

    expect(mockPatients.mock.calls[0][0].where).toEqual({
      id: { in: ["pet-1"] },
    });
  });

  it("drops a reminder whose companion row cannot be read rather than emitting a nameless one", async () => {
    mockPatients.mockResolvedValue([]);
    mockReminders.mockResolvedValue([reminderRow()]);

    const page = await listDueCareRemindersForParent("parent-1", { now: NOW });

    expect(page.reminders).toEqual([]);
  });

  it("serialises the dates the client needs to render a local day", async () => {
    mockReminders.mockResolvedValue([
      reminderRow({ sentAt: new Date("2026-09-09T08:30:00.000Z") }),
    ]);

    const page = await listDueCareRemindersForParent("parent-1", { now: NOW });

    expect(page.reminders[0].dueDate).toBe("2026-09-10T00:00:00.000Z");
    expect(page.reminders[0].sentAt).toBe("2026-09-09T08:30:00.000Z");
  });

  it("leaves sentAt off a reminder that was never sent", async () => {
    mockReminders.mockResolvedValue([reminderRow({ sentAt: null })]);

    const page = await listDueCareRemindersForParent("parent-1", { now: NOW });

    expect(page.reminders[0].sentAt).toBeUndefined();
  });
});

describe("paging", () => {
  it("reads one row over the page so hasMore is measured rather than guessed", async () => {
    mockReminders.mockResolvedValue([
      reminderRow({ id: "r1" }),
      reminderRow({ id: "r2" }),
      reminderRow({ id: "r3" }),
    ]);

    const page = await listDueCareRemindersForParent("parent-1", {
      limit: "2",
      now: NOW,
    });

    expect(mockReminders.mock.calls[0][0].take).toBe(3);
    expect(page.reminders.map((r) => r.id)).toEqual(["r1", "r2"]);
    expect(page.hasMore).toBe(true);
    expect(page.limit).toBe(2);
  });

  it("reports the end of the data rather than the end of a page", async () => {
    mockReminders.mockResolvedValue([reminderRow({ id: "r1" })]);

    const page = await listDueCareRemindersForParent("parent-1", {
      limit: "2",
      now: NOW,
    });

    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it("builds the next cursor from the due date, not from the row's creation", async () => {
    const due = new Date("2026-09-11T00:00:00.000Z");
    mockReminders.mockResolvedValue([
      reminderRow({ id: "r1" }),
      reminderRow({ id: CURSOR_UUID, dueDate: due }),
      reminderRow({ id: "r3" }),
    ]);

    const page = await listDueCareRemindersForParent("parent-1", {
      limit: "2",
      now: NOW,
    });

    expect(page.nextCursor).toBe(
      encodeCareReminderCursor({ dueDate: due, id: CURSOR_UUID }),
    );
  });

  it("walks forward with an exclusive comparison rather than an offset", async () => {
    const dueDate = new Date("2026-09-11T00:00:00.000Z");

    await listDueCareRemindersForParent("parent-1", {
      cursor: { dueDate, id: CURSOR_UUID },
      now: NOW,
    });

    const call = mockReminders.mock.calls[0][0];
    expect(call.where.OR).toEqual([
      { dueDate: { gt: dueDate } },
      { dueDate, id: { gt: CURSOR_UUID } },
    ]);
    expect(call.skip).toBeUndefined();
    expect(call.cursor).toBeUndefined();
  });

  it("rebuilds the scope on every page, so a borrowed cursor widens nothing", async () => {
    await listDueCareRemindersForParent("parent-1", {
      cursor: {
        dueDate: new Date("2026-09-11T00:00:00.000Z"),
        id: CURSOR_UUID,
      },
      now: NOW,
    });

    expect(mockReminders.mock.calls[0][0].where.patientId).toEqual({
      in: ["pet-1"],
    });
  });

  it("clamps an oversized page rather than rejecting it", async () => {
    const page = await listDueCareRemindersForParent("parent-1", {
      limit: "5000",
      now: NOW,
    });

    expect(mockReminders.mock.calls[0][0].take).toBe(
      MAX_CARE_REMINDER_PAGE_SIZE + 1,
    );
    expect(page.limit).toBe(MAX_CARE_REMINDER_PAGE_SIZE);
  });

  it("falls back to the default page size for a value it cannot use", async () => {
    const page = await listDueCareRemindersForParent("parent-1", {
      limit: "not-a-number",
      now: NOW,
    });

    expect(page.limit).toBe(DEFAULT_CARE_REMINDER_PAGE_SIZE);
  });
});

describe("cursor encoding", () => {
  it("round-trips a due date and an id", () => {
    const dueDate = new Date("2026-09-11T00:00:00.000Z");

    expect(
      parseCareReminderCursor(
        encodeCareReminderCursor({ dueDate, id: CURSOR_UUID }),
      ),
    ).toEqual({ dueDate, id: CURSOR_UUID });
  });

  it("reports an absent cursor and an unusable one differently", () => {
    expect(parseCareReminderCursor(undefined)).toBeUndefined();
    expect(parseCareReminderCursor("")).toBeUndefined();
    expect(parseCareReminderCursor("not-a-cursor")).toBeNull();
  });
});
