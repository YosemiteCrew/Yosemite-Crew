import {
  addCalendarDays,
  addCalendarMonths,
  breachNotificationDueAt,
  breachNotificationStatus,
  canActivityRun,
  evaluateErasure,
  obtainedDataNoticeDueOn,
  rightsRequestDueOn,
  rightsRequestStatus,
} from "../../../src/services/pharma/personal-data-rights";

const activity = {
  id: "field-study-owners",
  name: "Field study owner contact details",
  lawfulBasis: "legitimate-interests",
  dataSubjectClasses: ["animal owner"],
  personalDataFields: [{ field: "owner.email", necessityEndsAfterDays: 365 }],
  likelyHighRisk: false,
  impactAssessmentApprovedAt: null,
};

describe("canActivityRun", () => {
  it("allows a register entry with exactly one lawful basis", () => {
    const decision = canActivityRun(activity);
    expect(decision.allowed).toBe(true);
  });

  it.each([
    ["no basis", { ...activity, lawfulBasis: undefined }],
    ["an unknown basis", { ...activity, lawfulBasis: "convenience" }],
    [
      "two bases in one entry",
      { ...activity, lawfulBasis: ["consent", "contract"] },
    ],
    ["a second basis field", { ...activity, additionalLawfulBasis: "consent" }],
    ["no personal-data fields", { ...activity, personalDataFields: [] }],
    ["no data-subject classes", { ...activity, dataSubjectClasses: [] }],
    ["no entry at all", undefined],
  ])("refuses an entry with %s", (_label, entry) => {
    expect(canActivityRun(entry)).toEqual({
      allowed: false,
      reason: "invalid-register-entry",
    });
  });

  it("holds a likely high-risk activity until its impact assessment is approved", () => {
    expect(canActivityRun({ ...activity, likelyHighRisk: true })).toEqual({
      allowed: false,
      reason: "impact-assessment-pending",
    });
    expect(
      canActivityRun({
        ...activity,
        likelyHighRisk: true,
        impactAssessmentApprovedAt: "2026-10-01T09:00:00Z",
      }).allowed,
    ).toBe(true);
  });
});

describe("calendar arithmetic", () => {
  it.each([
    ["2026-01-31", 1, "2026-02-28"],
    ["2028-01-31", 1, "2028-02-29"],
    ["2026-01-15", 1, "2026-02-15"],
    ["2026-12-31", 1, "2027-01-31"],
    ["2026-11-30", 3, "2027-02-28"],
  ])("%s plus %i month(s) is %s", (date, months, expected) => {
    expect(addCalendarMonths(date, months)).toBe(expected);
  });

  it("adds days across a month and year end", () => {
    expect(addCalendarDays("2026-12-25", 10)).toBe("2027-01-04");
  });

  it.each(["2026-02-30", "2026-13-01", "2026-00-10", "31/01/2026", ""])(
    "refuses %p",
    (date) => {
      expect(() => addCalendarMonths(date, 1)).toThrow(RangeError);
    },
  );
});

describe("rights request clock", () => {
  it("is due one month after first receipt, at the end of a short month", () => {
    expect(rightsRequestDueOn({ receivedOn: "2026-01-31" })).toBe("2026-02-28");
  });

  it("is open on the due date and overdue the day after", () => {
    const clock = { receivedOn: "2026-01-31" };
    expect(rightsRequestStatus(clock, "2026-02-28")).toBe("open");
    expect(rightsRequestStatus(clock, "2026-03-01")).toBe("overdue");
  });

  it("counts an answered request as answered whatever the date", () => {
    expect(
      rightsRequestStatus(
        { receivedOn: "2026-01-01", answeredOn: "2026-01-20" },
        "2026-06-01",
      ),
    ).toBe("answered");
  });

  it("extends by two further months when notice went out in the first month", () => {
    const clock = {
      receivedOn: "2026-01-31",
      extension: {
        months: 2,
        noticeSentOn: "2026-02-28",
        reasons: "Request covers several study sites",
      },
    };
    expect(rightsRequestDueOn(clock)).toBe("2026-04-28");
    expect(rightsRequestStatus(clock, "2026-04-28")).toBe("open");
    expect(rightsRequestStatus(clock, "2026-04-29")).toBe("overdue");
  });

  it.each([
    [
      "three further months",
      { months: 3, noticeSentOn: "2026-01-10", reasons: "x" },
    ],
    ["zero months", { months: 0, noticeSentOn: "2026-01-10", reasons: "x" }],
    ["a part month", { months: 1.5, noticeSentOn: "2026-01-10", reasons: "x" }],
    [
      "notice after the first month",
      { months: 1, noticeSentOn: "2026-02-02", reasons: "x" },
    ],
    [
      "notice before receipt",
      { months: 1, noticeSentOn: "2025-12-31", reasons: "x" },
    ],
    ["no reasons", { months: 1, noticeSentOn: "2026-01-10", reasons: "  " }],
  ])("refuses an extension with %s", (_label, extension) => {
    expect(() =>
      rightsRequestDueOn({ receivedOn: "2026-01-01", extension }),
    ).toThrow(RangeError);
  });

  it("refuses an invalid date for today", () => {
    expect(() =>
      rightsRequestStatus({ receivedOn: "2026-01-01" }, "today"),
    ).toThrow(RangeError);
  });
});

describe("notice for data obtained from someone else", () => {
  it("is due one month after the data were obtained", () => {
    expect(obtainedDataNoticeDueOn({ obtainedOn: "2026-01-31" })).toBe(
      "2026-02-28",
    );
  });

  it("moves earlier to the first contact", () => {
    expect(
      obtainedDataNoticeDueOn({
        obtainedOn: "2026-03-01",
        firstContactOn: "2026-03-10",
        firstDisclosureOn: "2026-03-20",
      }),
    ).toBe("2026-03-10");
  });

  it("moves earlier to the first disclosure", () => {
    expect(
      obtainedDataNoticeDueOn({
        obtainedOn: "2026-03-01",
        firstContactOn: null,
        firstDisclosureOn: "2026-03-05",
      }),
    ).toBe("2026-03-05");
  });

  it("stays at one month when first contact comes later", () => {
    expect(
      obtainedDataNoticeDueOn({
        obtainedOn: "2026-03-01",
        firstContactOn: "2026-06-01",
      }),
    ).toBe("2026-04-01");
  });

  it("refuses an invalid contact date", () => {
    expect(() =>
      obtainedDataNoticeDueOn({
        obtainedOn: "2026-03-01",
        firstContactOn: "2026-03-32",
      }),
    ).toThrow(RangeError);
  });
});

describe("breach notification clock", () => {
  const berlinWallClock = (date: Date) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Berlin",
      dateStyle: "short",
      timeStyle: "short",
    }).format(date);

  it("is 72 elapsed hours across the spring clock change", () => {
    const awareAt = new Date("2026-03-27T09:00:00Z");
    const dueAt = breachNotificationDueAt(awareAt);
    expect(dueAt.toISOString()).toBe("2026-03-30T09:00:00.000Z");
    expect(berlinWallClock(awareAt)).toBe("27/03/2026, 10:00");
    expect(berlinWallClock(dueAt)).toBe("30/03/2026, 11:00");
  });

  it("is 72 elapsed hours across the autumn clock change", () => {
    const awareAt = new Date("2026-10-23T10:00:00Z");
    const dueAt = breachNotificationDueAt(awareAt);
    expect(dueAt.toISOString()).toBe("2026-10-26T10:00:00.000Z");
    expect(berlinWallClock(awareAt)).toBe("23/10/2026, 12:00");
    expect(berlinWallClock(dueAt)).toBe("26/10/2026, 11:00");
  });

  const awareAt = new Date("2026-05-01T08:00:00Z");
  const justBeforeDue = new Date("2026-05-04T08:00:00Z");
  const justAfterDue = new Date("2026-05-04T08:00:01Z");

  it("is pending until the due time and overdue after it", () => {
    expect(breachNotificationStatus({ awareAt }, justBeforeDue)).toBe(
      "pending",
    );
    expect(breachNotificationStatus({ awareAt }, justAfterDue)).toBe("overdue");
  });

  it("is not required when no risk to people is recorded", () => {
    expect(
      breachNotificationStatus(
        { awareAt, noRiskReason: "Encrypted copy, key not affected" },
        justAfterDue,
      ),
    ).toBe("not-required");
    expect(
      breachNotificationStatus({ awareAt, noRiskReason: " " }, justAfterDue),
    ).toBe("overdue");
  });

  it("separates on-time, late with reasons and late without reasons", () => {
    expect(
      breachNotificationStatus(
        { awareAt, notifiedAt: justBeforeDue },
        justAfterDue,
      ),
    ).toBe("notified");
    expect(
      breachNotificationStatus(
        {
          awareAt,
          notifiedAt: justAfterDue,
          delayReasons: "Scope confirmed with the processor first",
        },
        justAfterDue,
      ),
    ).toBe("notified-late-with-reasons");
    expect(
      breachNotificationStatus(
        { awareAt, notifiedAt: justAfterDue },
        justAfterDue,
      ),
    ).toBe("overdue");
  });
});

describe("evaluateErasure", () => {
  const today = "2026-10-03";

  it("itemises owner, reporter and prescriber data against retention duties", () => {
    const answer = evaluateErasure(
      [
        { field: "owner.email", recordClass: "field-study-owner" },
        {
          field: "reporter.name",
          recordClass: "safety-case",
          retentionDuty: {
            duty: "Safety case retention",
            keepUntil: "2036-10-03",
          },
        },
        {
          field: "reporter.phone",
          recordClass: "safety-case",
          retentionDuty: {
            duty: "Safety case retention",
            keepUntil: "2026-10-03",
          },
        },
        {
          field: "prescriber.callNotes",
          recordClass: "commercial-call",
          restrictionGround: "Pending legal claim",
        },
        {
          field: "prescriber.email",
          recordClass: "commercial-contact",
          restrictionGround: "",
        },
      ],
      { today, backupRetentionDays: 35 },
    );

    expect(answer).toEqual({
      erased: ["owner.email", "reporter.phone", "prescriber.email"],
      restricted: [
        { field: "prescriber.callNotes", ground: "Pending legal claim" },
      ],
      kept: [
        {
          field: "reporter.name",
          duty: "Safety case retention",
          until: "2036-10-03",
        },
      ],
      lastBackupExpiresOn: "2026-11-07",
    });
  });

  it("keeps data under a live duty even when a restriction ground is also recorded", () => {
    const answer = evaluateErasure(
      [
        {
          field: "reporter.name",
          recordClass: "safety-case",
          retentionDuty: {
            duty: "Safety case retention",
            keepUntil: "2030-01-01",
          },
          restrictionGround: "Pending legal claim",
        },
      ],
      { today, backupRetentionDays: 0 },
    );
    expect(answer.kept).toHaveLength(1);
    expect(answer.restricted).toEqual([]);
    expect(answer.lastBackupExpiresOn).toBe(today);
  });

  it.each([-1, 1.5])("refuses %p backup retention days", (days) => {
    expect(() =>
      evaluateErasure([], { today, backupRetentionDays: days }),
    ).toThrow(RangeError);
  });

  it("refuses an invalid retention end date", () => {
    expect(() =>
      evaluateErasure(
        [
          {
            field: "reporter.name",
            recordClass: "safety-case",
            retentionDuty: { duty: "Safety case retention", keepUntil: "soon" },
          },
        ],
        { today, backupRetentionDays: 0 },
      ),
    ).toThrow(RangeError);
  });
});
