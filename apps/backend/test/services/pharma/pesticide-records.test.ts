import {
  canDispatchUnderExperimentalPermit,
  canStartPesticideBatch,
  pesticideNoticeDueOn,
  pesticideNoticeStatus,
  pesticideRecordRetention,
  researchDataMustBeKept,
} from "../../../src/services/pharma/pesticide-records";

describe("pesticideRecordRetention", () => {
  it.each([
    "production",
    "device-production",
    "receipt",
    "shipment",
    "restricted-use-advertising",
  ] as const)(
    "keeps %s records for two years from the latest event",
    (recordClass) => {
      expect(
        pesticideRecordRetention({ recordClass, latestEventOn: "2026-02-28" }),
      ).toEqual({
        keepUntil: "2028-02-28",
        mayForwardAfter: null,
        awaitingConfirmation: true,
        reason: "two-years-from-latest-event",
      });
    },
  );

  it("keeps a guaranty for one year after expiry", () => {
    expect(
      pesticideRecordRetention({
        recordClass: "guaranty",
        expiresOn: "2026-07-31",
      }),
    ).toEqual({
      keepUntil: "2027-07-31",
      mayForwardAfter: null,
      awaitingConfirmation: false,
      reason: "one-year-after-guaranty-expiry",
    });
  });

  it("keeps an export contract for two years after expiry", () => {
    expect(
      pesticideRecordRetention({
        recordClass: "export-contract",
        expiresOn: "2026-07-31",
      }),
    ).toEqual({
      keepUntil: "2028-07-31",
      mayForwardAfter: null,
      awaitingConfirmation: false,
      reason: "two-years-after-contract-expiry",
    });
  });

  it.each(["disposal", "human-test"] as const)(
    "keeps a %s record for twenty years or permits forwarding after three",
    (recordClass) => {
      expect(
        pesticideRecordRetention({
          recordClass,
          latestEventOn: "2026-02-28",
        }),
      ).toEqual({
        keepUntil: "2046-02-28",
        mayForwardAfter: "2029-02-28",
        awaitingConfirmation: true,
        reason: "twenty-years-or-forward-after-three",
      });
    },
  );

  it("does not invent a calendar end for research data", () => {
    expect(
      pesticideRecordRetention({
        recordClass: "research-data",
        registrationValid: true,
        companyInBusiness: true,
      }),
    ).toEqual({
      keepUntil: null,
      mayForwardAfter: null,
      awaitingConfirmation: false,
      reason: "while-registration-valid-and-company-in-business",
    });
  });

  it.each([
    [true, true, true],
    [true, false, false],
    [false, true, false],
    [false, false, false],
  ])(
    "keeps research data for registration=%s and business=%s: %s",
    (registrationValid, companyInBusiness, expected) => {
      expect(
        researchDataMustBeKept({ registrationValid, companyInBusiness }),
      ).toBe(expected);
    },
  );

  it("refuses an invalid retention date", () => {
    expect(() =>
      pesticideRecordRetention({
        recordClass: "shipment",
        latestEventOn: "2026-02-30",
      }),
    ).toThrow(RangeError);
  });
});

describe("pesticideNoticeDueOn", () => {
  it("runs cancellation from the later of receipt and publication", () => {
    expect(
      pesticideNoticeDueOn({
        kind: "intent-to-cancel",
        receivedOn: "2026-04-01",
        publishedOn: "2026-04-10",
        delivery: "delivered",
      }),
    ).toBe("2026-05-10");
    expect(
      pesticideNoticeDueOn({
        kind: "intent-to-cancel",
        receivedOn: "2026-04-12",
        publishedOn: "2026-04-10",
        delivery: "delivered",
      }),
    ).toBe("2026-05-12");
  });

  it.each(["undeliverable", "refused"] as const)(
    "deems an %s notice received on publication",
    (delivery) => {
      expect(
        pesticideNoticeDueOn({
          kind: "intent-to-cancel",
          receivedOn: "2026-05-20",
          publishedOn: "2026-04-10",
          delivery,
        }),
      ).toBe("2026-05-10");
    },
  );

  it.each([
    [
      "conditional registration",
      { kind: "conditional-registration", receivedOn: "2026-01-01" } as const,
      "2026-01-31",
    ],
    [
      "imminent-hazard suspension",
      {
        kind: "imminent-hazard-suspension",
        receivedOn: "2026-01-01",
      } as const,
      "2026-01-06",
    ],
    [
      "emergency-suspension follow-up",
      { kind: "emergency-suspension", effectiveOn: "2026-01-01" } as const,
      "2026-04-01",
    ],
    [
      "missed-data suspension",
      { kind: "missed-data-suspension", receivedOn: "2026-01-01" } as const,
      "2026-01-31",
    ],
    [
      "voluntary-cancellation comment",
      {
        kind: "voluntary-cancellation-comment",
        publishedOn: "2026-01-01",
      } as const,
      "2026-01-31",
    ],
    [
      "minor-use cancellation wait",
      {
        kind: "minor-use-cancellation-wait",
        requestedOn: "2026-01-01",
      } as const,
      "2026-06-30",
    ],
    [
      "registration transfer application",
      {
        kind: "registration-transfer-application",
        transferOn: "2026-01-01",
      } as const,
      "2026-01-31",
    ],
  ])("computes the %s deadline", (_label, notice, expected) => {
    expect(pesticideNoticeDueOn(notice)).toBe(expected);
  });

  it("is open through the due date and overdue the following day", () => {
    const notice = {
      kind: "imminent-hazard-suspension",
      receivedOn: "2026-01-01",
    } as const;
    expect(pesticideNoticeStatus(notice, "2026-01-06")).toBe("open");
    expect(pesticideNoticeStatus(notice, "2026-01-07")).toBe("overdue");
    expect(pesticideNoticeStatus(notice, "2026-01-07", "2026-01-05")).toBe(
      "completed",
    );
  });

  it.each([
    ["today", "2026-01-32", null],
    ["completion", "2026-01-02", "not-a-date"],
  ])("refuses an invalid %s date", (_label, today, completedOn) => {
    expect(() =>
      pesticideNoticeStatus(
        { kind: "conditional-registration", receivedOn: "2026-01-01" },
        today,
        completedOn,
      ),
    ).toThrow(RangeError);
  });
});

describe("pesticide production and dispatch guards", () => {
  it.each([
    "registration",
    "experimental-use-permit",
    "pending-application",
    "export",
  ] as const)("starts a batch with a referenced %s basis", (kind) => {
    expect(canStartPesticideBatch({ kind, reference: "basis-123" })).toEqual({
      allowed: true,
    });
  });

  it.each([undefined, null, { kind: "registration" as const, reference: " " }])(
    "refuses a batch without a complete registration basis",
    (basis) => {
      expect(canStartPesticideBatch(basis)).toEqual({
        allowed: false,
        reason: "registration-basis-required",
      });
    },
  );

  it("allows an experimental dispatch to a current permit participant", () => {
    expect(
      canDispatchUnderExperimentalPermit({
        consigneeId: "site-2",
        participantIds: ["site-1", "site-2"],
      }),
    ).toEqual({ allowed: true });
  });

  it("refuses an experimental dispatch to anyone else", () => {
    expect(
      canDispatchUnderExperimentalPermit({
        consigneeId: "site-3",
        participantIds: ["site-1", "site-2"],
      }),
    ).toEqual({
      allowed: false,
      reason: "permit-participant-required",
    });
  });
});
