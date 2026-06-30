import { SOAPNoteService, SOAPNoteError } from "src/services/soap-note.service";
import { prisma } from "src/config/prisma";
import { AuditTrailService } from "src/services/audit-trail.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    sOAPNote: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("src/services/audit-trail.service", () => ({
  AuditTrailService: { recordSafely: jest.fn().mockResolvedValue(undefined) },
}));

const pm = prisma as unknown as {
  sOAPNote: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
};

const makeNote = (over: Record<string, unknown> = {}) => ({
  id: "note-1",
  organisationId: "org-1",
  patientId: "pat-1",
  encounterId: "enc-1",
  authorId: "vet-1",
  noteDate: new Date("2026-06-30T09:00:00Z"),
  subjective: "Owner reports lethargy for 2 days",
  objective: "T 39.5C, HR 110 bpm, pale mucous membranes",
  assessment: "Suspected anaemia - differentials include IMHA, haemorrhage",
  plan: "CBC, blood smear, urinalysis. Start IV fluids at 10ml/kg/hr",
  signedAt: null,
  signedBy: null,
  isAmended: false,
  amendedReason: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  (AuditTrailService.recordSafely as jest.Mock).mockResolvedValue(undefined);
  pm.sOAPNote.findFirst.mockResolvedValue(makeNote());
  pm.sOAPNote.create.mockResolvedValue(makeNote());
  pm.sOAPNote.update.mockImplementation(
    (args: { data: Record<string, unknown> }) =>
      Promise.resolve(makeNote({ ...args.data })),
  );
  pm.sOAPNote.findMany.mockResolvedValue([makeNote()]);
});

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

describe("SOAPNoteService.create", () => {
  it("creates a SOAP note and emits audit", async () => {
    const result = await SOAPNoteService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      encounterId: "enc-1",
      authorId: "vet-1",
      noteDate: new Date("2026-06-30T09:00:00Z"),
      subjective: "Owner reports lethargy",
      objective: "T 39.5C",
      assessment: "Suspected anaemia",
      plan: "CBC",
    });
    expect(pm.sOAPNote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subjective: "Owner reports lethargy",
          authorId: "vet-1",
        }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "SOAP_NOTE_CREATED",
        actorId: "vet-1",
      }),
    );
    expect(result.isAmended).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// get / list
// ---------------------------------------------------------------------------

describe("SOAPNoteService.get", () => {
  it("returns a note by id and org", async () => {
    const result = await SOAPNoteService.get("note-1", "org-1");
    expect(result.id).toBe("note-1");
  });

  it("404s an unknown note", async () => {
    pm.sOAPNote.findFirst.mockResolvedValue(null);
    await expect(SOAPNoteService.get("bad", "org-1")).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("SOAPNoteService.list", () => {
  it("lists notes for the org", async () => {
    const result = await SOAPNoteService.list({ organisationId: "org-1" });
    expect(result).toHaveLength(1);
  });

  it("filters by patientId, encounterId, authorId", async () => {
    await SOAPNoteService.list({
      organisationId: "org-1",
      patientId: "pat-1",
      encounterId: "enc-1",
      authorId: "vet-1",
    });
    expect(pm.sOAPNote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          patientId: "pat-1",
          encounterId: "enc-1",
          authorId: "vet-1",
        }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

describe("SOAPNoteService.update", () => {
  it("updates an unsigned note", async () => {
    await SOAPNoteService.update("note-1", "org-1", {
      plan: "Updated plan: add IV fluids",
    });
    expect(pm.sOAPNote.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ plan: "Updated plan: add IV fluids" }),
      }),
    );
  });

  it("rejects update on a signed note", async () => {
    pm.sOAPNote.findFirst.mockResolvedValue(makeNote({ signedAt: new Date() }));
    await expect(
      SOAPNoteService.update("note-1", "org-1", { plan: "..." }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

// ---------------------------------------------------------------------------
// sign
// ---------------------------------------------------------------------------

describe("SOAPNoteService.sign", () => {
  it("stamps signedAt and emits audit", async () => {
    pm.sOAPNote.update.mockResolvedValue(
      makeNote({ signedAt: new Date(), signedBy: "vet-1" }),
    );
    const result = await SOAPNoteService.sign("note-1", "org-1", "vet-1");
    expect(pm.sOAPNote.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          signedAt: expect.any(Date),
          signedBy: "vet-1",
        }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "SOAP_NOTE_SIGNED",
        actorId: "vet-1",
      }),
    );
    expect(result.signedBy).toBe("vet-1");
  });

  it("rejects double-signing", async () => {
    pm.sOAPNote.findFirst.mockResolvedValue(makeNote({ signedAt: new Date() }));
    await expect(
      SOAPNoteService.sign("note-1", "org-1", "vet-1"),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

// ---------------------------------------------------------------------------
// amend
// ---------------------------------------------------------------------------

describe("SOAPNoteService.amend", () => {
  it("amends a signed note and emits audit", async () => {
    pm.sOAPNote.findFirst.mockResolvedValue(makeNote({ signedAt: new Date() }));
    pm.sOAPNote.update.mockResolvedValue(
      makeNote({ isAmended: true, amendedReason: "Correction to plan" }),
    );
    const result = await SOAPNoteService.amend(
      "note-1",
      "org-1",
      { plan: "Corrected plan", amendedReason: "Correction to plan" },
      "vet-1",
    );
    expect(pm.sOAPNote.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isAmended: true,
          amendedReason: "Correction to plan",
        }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "SOAP_NOTE_AMENDED" }),
    );
    expect(result.isAmended).toBe(true);
  });

  it("rejects amending an unsigned note", async () => {
    await expect(
      SOAPNoteService.amend("note-1", "org-1", {
        plan: "...",
        amendedReason: "oops",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
