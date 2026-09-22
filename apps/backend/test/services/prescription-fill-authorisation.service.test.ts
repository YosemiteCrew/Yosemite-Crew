import { Prisma } from "@prisma/client";
import { prisma } from "src/config/prisma";
import {
  PrescriptionFillAuthorisationService,
  PrescriptionFillAuthorisationServiceError,
} from "../../src/services/prescription-fill-authorisation.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    // Every read-then-write on an item's authorisation takes an advisory lock
    // first, so a mock without this throws before any assertion is reached.
    $executeRaw: jest.fn(),
    prescriptionItem: { findFirst: jest.fn() },
    encounter: { findFirst: jest.fn() },
    prescriptionFillAuthorization: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    prescriptionFillReservation: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

type MockedPrisma = {
  $transaction: jest.Mock;
  $executeRaw: jest.Mock;
  prescriptionItem: { findFirst: jest.Mock };
  encounter: { findFirst: jest.Mock };
  prescriptionFillAuthorization: {
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  prescriptionFillReservation: {
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
};

const db = prisma as unknown as MockedPrisma;

const ORG = "org-A";
const OTHER_ORG = "org-B";
const ITEM = "item-1";
const NOW = new Date("2026-03-01T09:00:00.000Z");
const VALID_UNTIL = new Date("2026-06-01T00:00:00.000Z");

const authority = (overrides: Record<string, unknown> = {}) => ({
  id: "auth-1",
  organisationId: ORG,
  itemId: ITEM,
  prescriptionId: "rx-1",
  version: 1,
  status: "ACTIVE",
  validUntil: VALID_UNTIL,
  maxAdditionalFills: 2,
  perFillQuantity: new Prisma.Decimal("10"),
  perFillQuantityUnit: "tablet",
  ...overrides,
});

const reservation = (overrides: Record<string, unknown> = {}) => ({
  id: "res-1",
  organisationId: ORG,
  authorizationId: "auth-1",
  itemId: ITEM,
  fillOrdinal: 0,
  quantity: new Prisma.Decimal("10"),
  fulfilledQuantity: new Prisma.Decimal("0"),
  quantityUnit: "tablet",
  status: "RESERVED",
  idempotencyKey: "key-1",
  ...overrides,
});

const expectRefusal = async (
  run: () => Promise<unknown>,
  status: number,
  messageFragment: string,
) => {
  await expect(run()).rejects.toBeInstanceOf(
    PrescriptionFillAuthorisationServiceError,
  );
  await expect(run()).rejects.toMatchObject({ statusCode: status });
  await expect(run()).rejects.toThrow(messageFragment);
};

beforeEach(() => {
  jest.clearAllMocks();
  // The service's transactions only ever touch the same client, so handing the
  // callback the mock itself keeps one set of expectations for both paths.
  db.$transaction.mockImplementation((callback: (tx: unknown) => unknown) =>
    callback(db),
  );
  db.$executeRaw.mockResolvedValue(1);
  db.prescriptionItem.findFirst.mockResolvedValue({
    id: ITEM,
    prescriptionId: "rx-1",
    prescription: {
      artifact: { encounterId: "enc-1", authorId: "clinician-1" },
    },
  });
  db.encounter.findFirst.mockResolvedValue({ patientId: "pat-1" });
  db.prescriptionFillAuthorization.findFirst.mockResolvedValue(null);
  db.prescriptionFillAuthorization.create.mockImplementation(
    ({ data }: { data: Record<string, unknown> }) => ({
      id: "auth-new",
      ...data,
    }),
  );
  db.prescriptionFillAuthorization.update.mockImplementation(
    ({ data }: { data: Record<string, unknown> }) => ({
      id: "auth-1",
      ...data,
    }),
  );
  db.prescriptionFillReservation.findUnique.mockResolvedValue(null);
  db.prescriptionFillReservation.findFirst.mockResolvedValue(null);
  db.prescriptionFillReservation.count.mockResolvedValue(0);
  db.prescriptionFillReservation.create.mockImplementation(
    ({ data }: { data: Record<string, unknown> }) => ({
      id: "res-new",
      ...data,
    }),
  );
  db.prescriptionFillReservation.update.mockImplementation(
    ({ data }: { data: Record<string, unknown> }) => ({ id: "res-1", ...data }),
  );
});

describe("authoriseFills", () => {
  const input = {
    organisationId: ORG,
    itemId: ITEM,
    validUntil: VALID_UNTIL,
    maxAdditionalFills: 2,
    perFillQuantity: "10",
    perFillQuantityUnit: "tablet",
    authorisedBy: "clinician-1",
    canEditAny: true,
    now: NOW,
  };

  it("issues version 1 with the patient resolved from the encounter", async () => {
    const created =
      await PrescriptionFillAuthorisationService.authoriseFills(input);

    expect(db.prescriptionFillAuthorization.create).toHaveBeenCalledTimes(1);
    expect(created).toMatchObject({
      organisationId: ORG,
      itemId: ITEM,
      prescriptionId: "rx-1",
      patientId: "pat-1",
      version: 1,
      maxAdditionalFills: 2,
      perFillQuantityUnit: "tablet",
      authorisedBy: "clinician-1",
    });
    expect(created.supersedesId).toBeUndefined();
  });

  it("takes the item's advisory lock before reading the previous authority", async () => {
    await PrescriptionFillAuthorisationService.authoriseFills(input);

    expect(db.$executeRaw).toHaveBeenCalledTimes(1);
    expect(db.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      db.prescriptionFillAuthorization.findFirst.mock.invocationCallOrder[0],
    );
  });

  it("supersedes the active authority and takes the next version", async () => {
    db.prescriptionFillAuthorization.findFirst.mockResolvedValue(
      authority({ id: "auth-old", version: 3 }),
    );

    const created =
      await PrescriptionFillAuthorisationService.authoriseFills(input);

    expect(db.prescriptionFillAuthorization.update).toHaveBeenCalledWith({
      where: { id: "auth-old" },
      data: { status: "SUPERSEDED" },
    });
    expect(created).toMatchObject({ version: 4, supersedesId: "auth-old" });
  });

  it("records no patient when the artifact has no encounter", async () => {
    db.prescriptionItem.findFirst.mockResolvedValue({
      id: ITEM,
      prescriptionId: "rx-1",
      prescription: { artifact: { encounterId: null } },
    });

    const created =
      await PrescriptionFillAuthorisationService.authoriseFills(input);

    expect(db.encounter.findFirst).not.toHaveBeenCalled();
    expect(created.patientId).toBeNull();
  });

  it("records no patient when the encounter is not this organisation's", async () => {
    db.encounter.findFirst.mockResolvedValue(null);

    const created =
      await PrescriptionFillAuthorisationService.authoriseFills(input);

    expect(created.patientId).toBeNull();
  });

  it("refuses an item that belongs to another organisation", async () => {
    db.prescriptionItem.findFirst.mockResolvedValue(null);

    await expectRefusal(
      () =>
        PrescriptionFillAuthorisationService.authoriseFills({
          ...input,
          organisationId: OTHER_ORG,
        }),
      404,
      "Prescription item not found",
    );
    expect(db.prescriptionFillAuthorization.create).not.toHaveBeenCalled();
  });

  it.each([
    ["organisationId", { organisationId: "  " }],
    ["itemId", { itemId: "" }],
    ["perFillQuantityUnit", { perFillQuantityUnit: " " }],
    ["authorisedBy", { authorisedBy: "" }],
  ])("requires %s", async (field, override) => {
    await expectRefusal(
      () =>
        PrescriptionFillAuthorisationService.authoriseFills({
          ...input,
          ...override,
        }),
      400,
      `${field} is required`,
    );
  });

  it.each([-1, 1.5])(
    "refuses maxAdditionalFills %p",
    async (maxAdditionalFills) => {
      await expectRefusal(
        () =>
          PrescriptionFillAuthorisationService.authoriseFills({
            ...input,
            maxAdditionalFills,
          }),
        400,
        "maxAdditionalFills must be a non-negative integer",
      );
    },
  );

  it.each(["0", "-2"])(
    "refuses perFillQuantity %p",
    async (perFillQuantity) => {
      await expectRefusal(
        () =>
          PrescriptionFillAuthorisationService.authoriseFills({
            ...input,
            perFillQuantity,
          }),
        400,
        "perFillQuantity must be greater than zero",
      );
    },
  );

  it("refuses a validUntil that is already now", async () => {
    await expectRefusal(
      () =>
        PrescriptionFillAuthorisationService.authoriseFills({
          ...input,
          validUntil: NOW,
        }),
      400,
      "validUntil must be in the future",
    );
  });

  it("allows zero additional fills, which authorises the initial fill only", async () => {
    const created = await PrescriptionFillAuthorisationService.authoriseFills({
      ...input,
      maxAdditionalFills: 0,
    });

    expect(created.maxAdditionalFills).toBe(0);
  });
});

describe("revokeAuthorization", () => {
  const input = {
    organisationId: ORG,
    authorizationId: "auth-1",
    revokedBy: "clinician-1",
    canEditAny: true,
    reason: "Dose changed",
    now: NOW,
  };

  it("revokes an active authority and records who and why", async () => {
    db.prescriptionFillAuthorization.findFirst.mockResolvedValue(authority());

    const revoked =
      await PrescriptionFillAuthorisationService.revokeAuthorization(input);

    expect(db.prescriptionFillAuthorization.update).toHaveBeenCalledWith({
      where: { id: "auth-1" },
      data: {
        status: "REVOKED",
        revokedBy: "clinician-1",
        revokedAt: NOW,
        revokedReason: "Dose changed",
      },
    });
    expect(revoked).toMatchObject({ status: "REVOKED" });
  });

  it("stores no reason when none was given", async () => {
    db.prescriptionFillAuthorization.findFirst.mockResolvedValue(authority());

    await PrescriptionFillAuthorisationService.revokeAuthorization({
      ...input,
      reason: undefined,
    });

    expect(
      db.prescriptionFillAuthorization.update.mock.calls[0][0].data
        .revokedReason,
    ).toBeUndefined();
  });

  it("refuses an authority in another organisation", async () => {
    db.prescriptionFillAuthorization.findFirst.mockResolvedValue(null);

    await expectRefusal(
      () =>
        PrescriptionFillAuthorisationService.revokeAuthorization({
          ...input,
          organisationId: OTHER_ORG,
        }),
      404,
      "Fill authorisation not found",
    );
  });

  it.each(["REVOKED", "SUPERSEDED"])(
    "refuses to revoke a %s authority",
    async (status) => {
      db.prescriptionFillAuthorization.findFirst.mockResolvedValue(
        authority({ status }),
      );

      await expectRefusal(
        () => PrescriptionFillAuthorisationService.revokeAuthorization(input),
        409,
        "Only an active fill authorisation can be revoked",
      );
    },
  );

  it("requires revokedBy", async () => {
    await expectRefusal(
      () =>
        PrescriptionFillAuthorisationService.revokeAuthorization({
          ...input,
          revokedBy: " ",
        }),
      400,
      "revokedBy is required",
    );
  });
});

describe("getFillEligibility", () => {
  const input = { organisationId: ORG, itemId: ITEM, now: NOW };

  it("reports NOT_AUTHORISED when the item has no authority at all", async () => {
    const eligibility =
      await PrescriptionFillAuthorisationService.getFillEligibility(input);

    expect(eligibility).toEqual({
      authorizationId: null,
      version: null,
      eligible: false,
      reasonCodes: ["NOT_AUTHORISED"],
      remainingFills: 0,
      remainingQuantity: null,
      unit: null,
      expiresAt: null,
    });
  });

  it.each([
    ["REVOKED", "AUTHORITY_REVOKED"],
    ["SUPERSEDED", "AUTHORITY_SUPERSEDED"],
  ])("distinguishes a %s authority", async (status, reason) => {
    db.prescriptionFillAuthorization.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ status });

    const eligibility =
      await PrescriptionFillAuthorisationService.getFillEligibility(input);

    expect(eligibility.reasonCodes).toEqual([reason]);
    expect(eligibility.eligible).toBe(false);
  });

  it("counts the initial fill plus the authorised repeats", async () => {
    db.prescriptionFillAuthorization.findFirst.mockResolvedValue(authority());
    db.prescriptionFillReservation.count.mockResolvedValue(0);

    const eligibility =
      await PrescriptionFillAuthorisationService.getFillEligibility(input);

    expect(eligibility).toMatchObject({
      authorizationId: "auth-1",
      version: 1,
      eligible: true,
      reasonCodes: [],
      remainingFills: 3,
      remainingQuantity: "30",
      unit: "tablet",
      expiresAt: VALID_UNTIL,
    });
  });

  it("ignores cancelled fills when counting what is left", async () => {
    db.prescriptionFillAuthorization.findFirst.mockResolvedValue(authority());
    db.prescriptionFillReservation.count.mockResolvedValue(1);

    const eligibility =
      await PrescriptionFillAuthorisationService.getFillEligibility(input);

    expect(db.prescriptionFillReservation.count).toHaveBeenCalledWith({
      where: { authorizationId: "auth-1", status: { not: "CANCELLED" } },
    });
    expect(eligibility.remainingFills).toBe(2);
    expect(eligibility.remainingQuantity).toBe("20");
  });

  it("is exhausted once the initial fill and every repeat are allocated", async () => {
    db.prescriptionFillAuthorization.findFirst.mockResolvedValue(authority());
    db.prescriptionFillReservation.count.mockResolvedValue(3);

    const eligibility =
      await PrescriptionFillAuthorisationService.getFillEligibility(input);

    expect(eligibility.reasonCodes).toEqual(["FILLS_EXHAUSTED"]);
    expect(eligibility.remainingFills).toBe(0);
    expect(eligibility.remainingQuantity).toBe("0");
  });

  it("expires AT validUntil, not after it", async () => {
    db.prescriptionFillAuthorization.findFirst.mockResolvedValue(authority());

    const eligibility =
      await PrescriptionFillAuthorisationService.getFillEligibility({
        ...input,
        now: VALID_UNTIL,
      });

    expect(eligibility.reasonCodes).toEqual(["AUTHORITY_EXPIRED"]);
    expect(eligibility.eligible).toBe(false);
  });

  it("is still eligible one millisecond before validUntil", async () => {
    db.prescriptionFillAuthorization.findFirst.mockResolvedValue(authority());

    const eligibility =
      await PrescriptionFillAuthorisationService.getFillEligibility({
        ...input,
        now: new Date(VALID_UNTIL.getTime() - 1),
      });

    expect(eligibility.eligible).toBe(true);
  });

  it("reports expiry and exhaustion together", async () => {
    db.prescriptionFillAuthorization.findFirst.mockResolvedValue(authority());
    db.prescriptionFillReservation.count.mockResolvedValue(3);

    const eligibility =
      await PrescriptionFillAuthorisationService.getFillEligibility({
        ...input,
        now: VALID_UNTIL,
      });

    expect(eligibility.reasonCodes).toEqual([
      "AUTHORITY_EXPIRED",
      "FILLS_EXHAUSTED",
    ]);
  });
});

describe("reserveFill", () => {
  const input = {
    organisationId: ORG,
    itemId: ITEM,
    idempotencyKey: "key-1",
    reservedBy: "staff-1",
    now: NOW,
  };

  it("allocates ordinal 0 at the authorised quantity for the first fill", async () => {
    db.prescriptionFillAuthorization.findFirst.mockResolvedValue(authority());

    const created =
      await PrescriptionFillAuthorisationService.reserveFill(input);

    expect(created).toMatchObject({
      authorizationId: "auth-1",
      fillOrdinal: 0,
      quantityUnit: "tablet",
      idempotencyKey: "key-1",
      reservedBy: "staff-1",
      reservedAt: NOW,
    });
    expect(created.quantity.toString()).toBe("10");
  });

  it("takes the advisory lock before counting what is left", async () => {
    db.prescriptionFillAuthorization.findFirst.mockResolvedValue(authority());

    await PrescriptionFillAuthorisationService.reserveFill(input);

    expect(db.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      db.prescriptionFillReservation.count.mock.invocationCallOrder[0],
    );
  });

  it("never reuses an ordinal, so a cancelled fill moves the sequence on", async () => {
    db.prescriptionFillAuthorization.findFirst.mockResolvedValue(authority());
    db.prescriptionFillReservation.count.mockResolvedValue(1);
    db.prescriptionFillReservation.findFirst.mockResolvedValue({
      fillOrdinal: 4,
    });

    const created =
      await PrescriptionFillAuthorisationService.reserveFill(input);

    expect(created.fillOrdinal).toBe(5);
  });

  it("replays the first reservation when the same key arrives again", async () => {
    const existing = reservation();
    db.prescriptionFillReservation.findUnique.mockResolvedValue(existing);

    const replayed =
      await PrescriptionFillAuthorisationService.reserveFill(input);

    expect(replayed).toBe(existing);
    expect(db.prescriptionFillReservation.create).not.toHaveBeenCalled();
  });

  it("refuses a key already spent on a different item", async () => {
    db.prescriptionFillReservation.findUnique.mockResolvedValue(
      reservation({ itemId: "item-2" }),
    );

    await expectRefusal(
      () => PrescriptionFillAuthorisationService.reserveFill(input),
      409,
      "already been used for a different prescription item",
    );
  });

  it("refuses when there is no active authority", async () => {
    db.prescriptionFillAuthorization.findFirst.mockResolvedValue(null);

    await expectRefusal(
      () => PrescriptionFillAuthorisationService.reserveFill(input),
      409,
      "No active fill authorisation",
    );
  });

  it("refuses a caller holding a superseded version", async () => {
    db.prescriptionFillAuthorization.findFirst.mockResolvedValue(
      authority({ version: 2 }),
    );

    await expectRefusal(
      () =>
        PrescriptionFillAuthorisationService.reserveFill({
          ...input,
          expectedVersion: 1,
        }),
      409,
      "has moved to version 2",
    );
    expect(db.prescriptionFillReservation.create).not.toHaveBeenCalled();
  });

  it("accepts a caller holding the current version", async () => {
    db.prescriptionFillAuthorization.findFirst.mockResolvedValue(
      authority({ version: 2 }),
    );

    await expect(
      PrescriptionFillAuthorisationService.reserveFill({
        ...input,
        expectedVersion: 2,
      }),
    ).resolves.toMatchObject({ fillOrdinal: 0 });
  });

  it.each([
    ["exhausted", 3, VALID_UNTIL.getTime() - 1, "FILLS_EXHAUSTED"],
    ["expired", 0, VALID_UNTIL.getTime(), "AUTHORITY_EXPIRED"],
  ])("refuses an %s authority", async (_label, allocated, at, reason) => {
    db.prescriptionFillAuthorization.findFirst.mockResolvedValue(authority());
    db.prescriptionFillReservation.count.mockResolvedValue(allocated);

    await expectRefusal(
      () =>
        PrescriptionFillAuthorisationService.reserveFill({
          ...input,
          now: new Date(at),
        }),
      409,
      reason,
    );
    expect(db.prescriptionFillReservation.create).not.toHaveBeenCalled();
  });

  it("requires an idempotencyKey", async () => {
    await expectRefusal(
      () =>
        PrescriptionFillAuthorisationService.reserveFill({
          ...input,
          idempotencyKey: "  ",
        }),
      400,
      "idempotencyKey is required",
    );
  });
});

describe("recordFulfilment", () => {
  const input = {
    organisationId: ORG,
    reservationId: "res-1",
    quantity: "3",
    now: NOW,
  };

  const withReservation = (overrides: Record<string, unknown> = {}) => {
    db.prescriptionFillReservation.findFirst.mockResolvedValue({
      ...reservation(overrides),
      authorization: authority(),
    });
  };

  it("accumulates a short fill on the same ordinal without completing it", async () => {
    withReservation();

    const updated =
      await PrescriptionFillAuthorisationService.recordFulfilment(input);

    const data = db.prescriptionFillReservation.update.mock.calls[0][0].data;
    expect(data.fulfilledQuantity.toString()).toBe("3");
    expect(data.status).toBeUndefined();
    expect(updated.completedAt).toBeUndefined();
  });

  it("does not consume a second repeat while a fill is still owing", async () => {
    withReservation({ fulfilledQuantity: new Prisma.Decimal("3") });

    await PrescriptionFillAuthorisationService.recordFulfilment({
      ...input,
      quantity: "4",
    });

    const data = db.prescriptionFillReservation.update.mock.calls[0][0].data;
    expect(data.fulfilledQuantity.toString()).toBe("7");
    expect(data.status).toBeUndefined();
  });

  it("completes the fill when the authorised quantity is reached", async () => {
    withReservation({ fulfilledQuantity: new Prisma.Decimal("7") });

    await PrescriptionFillAuthorisationService.recordFulfilment({
      ...input,
      quantity: "3",
    });

    expect(
      db.prescriptionFillReservation.update.mock.calls[0][0].data,
    ).toMatchObject({ status: "COMPLETED", completedAt: NOW });
  });

  it("refuses more than the authorised quantity for the fill", async () => {
    withReservation({ fulfilledQuantity: new Prisma.Decimal("9") });

    await expectRefusal(
      () =>
        PrescriptionFillAuthorisationService.recordFulfilment({
          ...input,
          quantity: "2",
        }),
      409,
      "exceed the authorised quantity",
    );
    expect(db.prescriptionFillReservation.update).not.toHaveBeenCalled();
  });

  it("refuses a fill completed at the exact moment the authority expires", async () => {
    withReservation();

    await expectRefusal(
      () =>
        PrescriptionFillAuthorisationService.recordFulfilment({
          ...input,
          now: VALID_UNTIL,
        }),
      409,
      "expired before this fill was completed",
    );
  });

  it.each(["COMPLETED", "CANCELLED"])(
    "refuses to fulfil a %s fill",
    async (status) => {
      withReservation({ status });

      await expectRefusal(
        () => PrescriptionFillAuthorisationService.recordFulfilment(input),
        409,
        "cannot be fulfilled",
      );
    },
  );

  it("refuses a reservation in another organisation", async () => {
    db.prescriptionFillReservation.findFirst.mockResolvedValue(null);

    await expectRefusal(
      () =>
        PrescriptionFillAuthorisationService.recordFulfilment({
          ...input,
          organisationId: OTHER_ORG,
        }),
      404,
      "Fill reservation not found",
    );
  });

  it.each(["0", "-1"])("refuses a quantity of %p", async (quantity) => {
    await expectRefusal(
      () =>
        PrescriptionFillAuthorisationService.recordFulfilment({
          ...input,
          quantity,
        }),
      400,
      "quantity must be greater than zero",
    );
  });
});

describe("cancelReservation", () => {
  const input = {
    organisationId: ORG,
    reservationId: "res-1",
    reason: "Owner did not collect",
    now: NOW,
  };

  it("releases an undispensed fill back to the authority", async () => {
    db.prescriptionFillReservation.findFirst.mockResolvedValue(reservation());

    await PrescriptionFillAuthorisationService.cancelReservation(input);

    expect(db.prescriptionFillReservation.update).toHaveBeenCalledWith({
      where: { id: "res-1" },
      data: {
        status: "CANCELLED",
        cancelledAt: NOW,
        cancelledReason: "Owner did not collect",
      },
    });
  });

  it("is a no-op on a fill that is already cancelled", async () => {
    const already = reservation({ status: "CANCELLED" });
    db.prescriptionFillReservation.findFirst.mockResolvedValue(already);

    await expect(
      PrescriptionFillAuthorisationService.cancelReservation(input),
    ).resolves.toBe(already);
    expect(db.prescriptionFillReservation.update).not.toHaveBeenCalled();
  });

  it("refuses to cancel a completed fill rather than minting a repeat", async () => {
    db.prescriptionFillReservation.findFirst.mockResolvedValue(
      reservation({ status: "COMPLETED" }),
    );

    await expectRefusal(
      () => PrescriptionFillAuthorisationService.cancelReservation(input),
      409,
      "reverse the dispense instead",
    );
    expect(db.prescriptionFillReservation.update).not.toHaveBeenCalled();
  });

  it("refuses a reservation in another organisation", async () => {
    db.prescriptionFillReservation.findFirst.mockResolvedValue(null);

    await expectRefusal(
      () =>
        PrescriptionFillAuthorisationService.cancelReservation({
          ...input,
          organisationId: OTHER_ORG,
        }),
      404,
      "Fill reservation not found",
    );
  });

  it("requires a reservationId", async () => {
    await expectRefusal(
      () =>
        PrescriptionFillAuthorisationService.cancelReservation({
          ...input,
          reservationId: "",
        }),
      400,
      "reservationId is required",
    );
  });
});

/*
 * The router admits `prescription:edit:own` holders on both write routes, so
 * the organisation join is not the whole of authorisation. These drive
 * `canEditAny: false` - the value an own-only caller produces - because every
 * other case in this file passes `true`, which returns before the authorship
 * comparison is ever reached.
 */
describe("own-only callers", () => {
  const otherAuthor = () =>
    db.prescriptionItem.findFirst.mockResolvedValue({
      id: ITEM,
      prescriptionId: "rx-1",
      prescription: {
        artifact: { encounterId: "enc-1", authorId: "clinician-2" },
      },
    });

  const authoriseAs = (actorId: string, canEditAny: boolean) =>
    PrescriptionFillAuthorisationService.authoriseFills({
      organisationId: ORG,
      itemId: ITEM,
      validUntil: VALID_UNTIL,
      maxAdditionalFills: 2,
      perFillQuantity: "10",
      perFillQuantityUnit: "tablet",
      authorisedBy: actorId,
      canEditAny,
      now: NOW,
    });

  const revokeAs = (actorId: string, canEditAny: boolean) =>
    PrescriptionFillAuthorisationService.revokeAuthorization({
      organisationId: ORG,
      authorizationId: "auth-1",
      revokedBy: actorId,
      canEditAny,
      now: NOW,
    });

  it("authorises fills on a prescription the caller wrote", async () => {
    await expect(authoriseAs("clinician-1", false)).resolves.toMatchObject({
      version: 1,
      authorisedBy: "clinician-1",
    });
  });

  it("refuses to authorise fills on another clinician's prescription", async () => {
    otherAuthor();

    await expectRefusal(
      () => authoriseAs("clinician-1", false),
      403,
      "authored by another user",
    );
    expect(db.prescriptionFillAuthorization.create).not.toHaveBeenCalled();
  });

  it("refuses to authorise when the prescription records no author", async () => {
    db.prescriptionItem.findFirst.mockResolvedValue({
      id: ITEM,
      prescriptionId: "rx-1",
      prescription: { artifact: { encounterId: "enc-1", authorId: null } },
    });

    await expectRefusal(
      () => authoriseAs("clinician-1", false),
      403,
      "authored by another user",
    );
    expect(db.prescriptionFillAuthorization.create).not.toHaveBeenCalled();
  });

  it("revokes an authority on a prescription the caller wrote", async () => {
    db.prescriptionFillAuthorization.findFirst.mockResolvedValue(authority());

    await expect(revokeAs("clinician-1", false)).resolves.toMatchObject({
      status: "REVOKED",
    });
  });

  it("refuses to revoke an authority on another clinician's prescription", async () => {
    db.prescriptionFillAuthorization.findFirst.mockResolvedValue(authority());
    otherAuthor();

    await expectRefusal(
      () => revokeAs("clinician-1", false),
      403,
      "authored by another user",
    );
    expect(db.prescriptionFillAuthorization.update).not.toHaveBeenCalled();
  });

  it("checks authorship against the item, not the authority row", async () => {
    db.prescriptionFillAuthorization.findFirst.mockResolvedValue(
      authority({ itemId: "item-9" }),
    );

    await revokeAs("clinician-1", false);

    expect(db.prescriptionItem.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "item-9",
          prescription: { artifact: { organisationId: ORG } },
        }),
      }),
    );
  });

  /*
   * The complement of the refusals above: without these, deleting the
   * `canEditAny` early return would leave every case in this file green except
   * where the author happens to differ.
   */
  it("lets an org-wide caller authorise on another clinician's prescription", async () => {
    otherAuthor();

    await expect(authoriseAs("clinician-1", true)).resolves.toMatchObject({
      version: 1,
    });
  });

  it("lets an org-wide caller revoke without reading the item at all", async () => {
    db.prescriptionFillAuthorization.findFirst.mockResolvedValue(authority());
    otherAuthor();

    await expect(revokeAs("clinician-1", true)).resolves.toMatchObject({
      status: "REVOKED",
    });
    expect(db.prescriptionItem.findFirst).not.toHaveBeenCalled();
  });
});

/*
 * The controller never passes `now` - every route lets the service read the
 * clock - so the `?? new Date()` default is the production path and not a test
 * convenience. Without these, every other case here injects a clock and the
 * only branch the product actually takes is the unexercised one.
 */
describe("the default clock", () => {
  const farFuture = new Date(Date.now() + 86_400_000);

  it("authorises against the real clock", async () => {
    await expect(
      PrescriptionFillAuthorisationService.authoriseFills({
        organisationId: ORG,
        itemId: ITEM,
        validUntil: farFuture,
        maxAdditionalFills: 1,
        perFillQuantity: "5",
        perFillQuantityUnit: "ml",
        authorisedBy: "clinician-1",
        canEditAny: true,
      }),
    ).resolves.toMatchObject({ version: 1 });
  });

  it("revokes against the real clock", async () => {
    db.prescriptionFillAuthorization.findFirst.mockResolvedValue(authority());

    const revoked =
      await PrescriptionFillAuthorisationService.revokeAuthorization({
        organisationId: ORG,
        authorizationId: "auth-1",
        revokedBy: "clinician-1",
        canEditAny: true,
      });

    expect(revoked.revokedAt).toBeInstanceOf(Date);
  });

  it("reads eligibility against the real clock", async () => {
    db.prescriptionFillAuthorization.findFirst.mockResolvedValue(
      authority({ validUntil: farFuture }),
    );

    await expect(
      PrescriptionFillAuthorisationService.getFillEligibility({
        organisationId: ORG,
        itemId: ITEM,
      }),
    ).resolves.toMatchObject({ eligible: true });
  });

  it("reserves against the real clock", async () => {
    db.prescriptionFillAuthorization.findFirst.mockResolvedValue(
      authority({ validUntil: farFuture }),
    );

    const created = await PrescriptionFillAuthorisationService.reserveFill({
      organisationId: ORG,
      itemId: ITEM,
      idempotencyKey: "key-1",
    });

    expect(created.reservedAt).toBeInstanceOf(Date);
  });

  it("fulfils against the real clock", async () => {
    db.prescriptionFillReservation.findFirst.mockResolvedValue({
      ...reservation(),
      authorization: authority({ validUntil: farFuture }),
    });

    await PrescriptionFillAuthorisationService.recordFulfilment({
      organisationId: ORG,
      reservationId: "res-1",
      quantity: "10",
    });

    expect(
      db.prescriptionFillReservation.update.mock.calls[0][0].data.completedAt,
    ).toBeInstanceOf(Date);
  });

  it("cancels against the real clock", async () => {
    db.prescriptionFillReservation.findFirst.mockResolvedValue(reservation());

    await PrescriptionFillAuthorisationService.cancelReservation({
      organisationId: ORG,
      reservationId: "res-1",
    });

    expect(
      db.prescriptionFillReservation.update.mock.calls[0][0].data.cancelledAt,
    ).toBeInstanceOf(Date);
  });
});
