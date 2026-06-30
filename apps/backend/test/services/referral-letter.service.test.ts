import {
  ReferralLetterService,
  ReferralLetterError,
} from "src/services/referral-letter.service";
import { prisma } from "src/config/prisma";
import { AuditTrailService } from "src/services/audit-trail.service";
import { sendEmail } from "src/utils/email";
import logger from "src/utils/logger";

jest.mock("src/config/prisma", () => ({
  prisma: {
    referralLetter: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    patient: { findUnique: jest.fn() },
  },
}));

jest.mock("src/services/audit-trail.service", () => ({
  AuditTrailService: { recordSafely: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock("src/utils/email", () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("src/utils/logger", () => ({ error: jest.fn(), info: jest.fn() }));

const pm = prisma as unknown as {
  referralLetter: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
  patient: { findUnique: jest.Mock };
};

const makeLetter = (over: Record<string, unknown> = {}) => ({
  id: "letter-1",
  organisationId: "org-1",
  patientId: "pat-1",
  encounterId: null,
  referringVetId: "vet-1",
  specialistName: "Dr Smith",
  specialistClinic: "Cardio Vet",
  specialistEmail: "smith@cardiovet.com",
  reasonForReferral: "Suspected cardiac arrhythmia",
  historySummary: null,
  examFindings: null,
  currentMedications: null,
  additionalNotes: null,
  status: "DRAFT",
  signedAt: null,
  sentAt: null,
  documensoEnvelopeId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  (AuditTrailService.recordSafely as jest.Mock).mockResolvedValue(undefined);
  (sendEmail as jest.Mock).mockResolvedValue(undefined);
  pm.referralLetter.findFirst.mockResolvedValue(makeLetter());
  pm.referralLetter.create.mockResolvedValue(makeLetter());
  pm.referralLetter.update.mockImplementation(
    (args: { data: Record<string, unknown> }) =>
      Promise.resolve(makeLetter({ ...args.data })),
  );
  pm.referralLetter.findMany.mockResolvedValue([makeLetter()]);
  pm.patient.findUnique.mockResolvedValue({ name: "Buddy" });
});

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

describe("ReferralLetterService.create", () => {
  it("creates a DRAFT referral letter", async () => {
    const result = await ReferralLetterService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      reasonForReferral: "Suspected cardiac arrhythmia",
    });
    expect(pm.referralLetter.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "DRAFT",
          reasonForReferral: "Suspected cardiac arrhythmia",
        }),
      }),
    );
    expect(result.status).toBe("DRAFT");
  });

  it("emits REFERRAL_LETTER_CREATED audit event", async () => {
    await ReferralLetterService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      reasonForReferral: "Cardiac issue",
      referringVetId: "vet-1",
    });
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "REFERRAL_LETTER_CREATED",
        actorId: "vet-1",
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// get / list
// ---------------------------------------------------------------------------

describe("ReferralLetterService.get", () => {
  it("returns a letter by id and org", async () => {
    const result = await ReferralLetterService.get("letter-1", "org-1");
    expect(result.id).toBe("letter-1");
  });

  it("404s an unknown letter", async () => {
    pm.referralLetter.findFirst.mockResolvedValue(null);
    await expect(
      ReferralLetterService.get("bad", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("ReferralLetterService.list", () => {
  it("lists letters for the org", async () => {
    const result = await ReferralLetterService.list({
      organisationId: "org-1",
    });
    expect(result).toHaveLength(1);
  });

  it("filters by patientId and status", async () => {
    await ReferralLetterService.list({
      organisationId: "org-1",
      patientId: "pat-1",
      status: "DRAFT",
    });
    expect(pm.referralLetter.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ patientId: "pat-1", status: "DRAFT" }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

describe("ReferralLetterService.update", () => {
  it("updates a DRAFT letter", async () => {
    await ReferralLetterService.update("letter-1", "org-1", {
      specialistName: "Dr Jones",
    });
    expect(pm.referralLetter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ specialistName: "Dr Jones" }),
      }),
    );
  });

  it("rejects updating a non-DRAFT letter", async () => {
    pm.referralLetter.findFirst.mockResolvedValue(
      makeLetter({ status: "SIGNED" }),
    );
    await expect(
      ReferralLetterService.update("letter-1", "org-1", {
        specialistName: "Dr Jones",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

// ---------------------------------------------------------------------------
// sign
// ---------------------------------------------------------------------------

describe("ReferralLetterService.sign", () => {
  it("transitions DRAFT to SIGNED and emits audit", async () => {
    const result = await ReferralLetterService.sign(
      "letter-1",
      "org-1",
      "vet-1",
    );
    expect(pm.referralLetter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "SIGNED" }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "REFERRAL_LETTER_SIGNED",
        actorId: "vet-1",
      }),
    );
    expect(result.status).toBe("SIGNED");
  });

  it("rejects signing a non-DRAFT letter", async () => {
    pm.referralLetter.findFirst.mockResolvedValue(
      makeLetter({ status: "SIGNED" }),
    );
    await expect(
      ReferralLetterService.sign("letter-1", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});

// ---------------------------------------------------------------------------
// send
// ---------------------------------------------------------------------------

describe("ReferralLetterService.send", () => {
  it("sends email and transitions to SENT", async () => {
    pm.referralLetter.findFirst.mockResolvedValue(
      makeLetter({ status: "SIGNED" }),
    );
    const result = await ReferralLetterService.send(
      "letter-1",
      "org-1",
      "vet-1",
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "smith@cardiovet.com" }),
    );
    expect(pm.referralLetter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "SENT" }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "REFERRAL_LETTER_SENT" }),
    );
    expect(result.status).toBe("SENT");
  });

  it("also sends from DRAFT status", async () => {
    await ReferralLetterService.send("letter-1", "org-1");
    expect(sendEmail).toHaveBeenCalled();
  });

  it("422s when no specialistEmail is set", async () => {
    pm.referralLetter.findFirst.mockResolvedValue(
      makeLetter({ status: "SIGNED", specialistEmail: null }),
    );
    await expect(
      ReferralLetterService.send("letter-1", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 422,
    });
  });

  it("502s when sendEmail throws", async () => {
    pm.referralLetter.findFirst.mockResolvedValue(
      makeLetter({ status: "SIGNED" }),
    );
    (sendEmail as jest.Mock).mockRejectedValueOnce(new Error("SMTP error"));
    await expect(
      ReferralLetterService.send("letter-1", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 502,
    });
  });

  it("rejects CANCELLED letters", async () => {
    pm.referralLetter.findFirst.mockResolvedValue(
      makeLetter({ status: "CANCELLED" }),
    );
    await expect(
      ReferralLetterService.send("letter-1", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});

// ---------------------------------------------------------------------------
// cancel
// ---------------------------------------------------------------------------

describe("ReferralLetterService.cancel", () => {
  it("transitions to CANCELLED", async () => {
    await ReferralLetterService.cancel("letter-1", "org-1", "vet-1");
    expect(pm.referralLetter.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "CANCELLED" } }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "REFERRAL_LETTER_CANCELLED" }),
    );
  });

  it("rejects cancelling a SENT letter", async () => {
    pm.referralLetter.findFirst.mockResolvedValue(
      makeLetter({ status: "SENT" }),
    );
    await expect(
      ReferralLetterService.cancel("letter-1", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("rejects cancelling an already-cancelled letter", async () => {
    pm.referralLetter.findFirst.mockResolvedValue(
      makeLetter({ status: "CANCELLED" }),
    );
    await expect(
      ReferralLetterService.cancel("letter-1", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});
