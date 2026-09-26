import { prisma } from "src/config/prisma";
import {
  awaitsClientSignature,
  hasActiveOrCompletedSigning,
  isConsentTemplate,
  isOpenSigning,
  loadDocumentsAwaitingClientSignature,
  lockClientRequest,
  templateNeedsClientSignature,
} from "../../src/services/client-signature.helpers";

jest.mock("src/config/prisma", () => ({
  prisma: {
    templateInstance: { findMany: jest.fn() },
    formAssignment: { findMany: jest.fn() },
  },
}));

const mockedPrisma = prisma as unknown as {
  templateInstance: { findMany: jest.Mock };
  formAssignment: { findMany: jest.Mock };
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("isConsentTemplate", () => {
  it.each([
    [{ kind: "CONSENT", rules: null }, true],
    [{ kind: "FORM", rules: { category: "Consent form" } }, true],
    [{ kind: "FORM", rules: { category: "Intake" } }, false],
    [{ kind: "FORM", rules: [] }, false],
    [{ kind: "SOAP_NOTE", rules: { category: "Consent form" } }, false],
  ])("reads %j as consent: %s", (template, expected) => {
    expect(isConsentTemplate(template)).toBe(expected);
  });
});

describe("templateNeedsClientSignature", () => {
  it.each([
    [{ kind: "FORM", rules: { requiredSigner: "CLIENT" } }, true],
    [{ kind: "FORM", rules: { requiredSigner: " client " } }, true],
    [{ kind: "FORM", rules: { requiredSigner: "VET" } }, false],
    [{ kind: "CONSENT", rules: { requiredSigner: "VET" } }, false],
    [{ kind: "CONSENT", rules: { requiredSigner: "" } }, true],
    [{ kind: "CONSENT", rules: null }, true],
    [{ kind: "FORM", rules: { requiredSigner: 3 } }, false],
    [{ kind: "FORM", rules: null }, false],
  ])("reads %j as client-signed: %s", (template, expected) => {
    expect(templateNeedsClientSignature(template)).toBe(expected);
  });
});

describe("lockClientRequest", () => {
  it("takes a transaction lock keyed on the form and appointment", async () => {
    const tx = { $executeRaw: jest.fn() };

    await lockClientRequest(tx as never, {
      organisationId: "org-1",
      templateId: "tpl-1",
      appointmentId: "appt-1",
    });

    const [sql, key] = tx.$executeRaw.mock.calls[0];
    expect(sql.join("?")).toBe("SELECT pg_advisory_xact_lock(hashtext(?))");
    expect(key).toBe("client-form-request:org-1:tpl-1:appt-1");
  });
});

describe("documents awaiting the client's signature", () => {
  const form = (id: string, overrides: Record<string, unknown> = {}) => ({
    id,
    kind: "FORM",
    organisationId: "org-1",
    templateId: `tpl-${id}`,
    templateInstanceId: `inst-${id}`,
    ...overrides,
  });
  const clientSigned = { kind: "FORM", rules: { requiredSigner: "CLIENT" } };

  it("holds every consent for the client without a lookup", async () => {
    await expect(
      awaitsClientSignature(
        form("c", {
          kind: "CONSENT",
          templateId: null,
          templateInstanceId: null,
        }),
      ),
    ).resolves.toBe(true);
    expect(mockedPrisma.templateInstance.findMany).not.toHaveBeenCalled();
  });

  it.each([
    ["no template", { templateId: null }],
    ["no template instance", { templateInstanceId: null }],
  ])("leaves out a form with %s without a lookup", async (_label, change) => {
    await expect(awaitsClientSignature(form("a", change))).resolves.toBe(false);
    expect(mockedPrisma.templateInstance.findMany).not.toHaveBeenCalled();
  });

  it("looks up a whole set in two queries", async () => {
    mockedPrisma.templateInstance.findMany.mockResolvedValueOnce([
      { id: "inst-a", appointmentId: "appt-1", template: clientSigned },
      { id: "inst-b", appointmentId: "appt-1", template: clientSigned },
      // Signed by the practice, so never the client's.
      {
        id: "inst-v",
        appointmentId: "appt-1",
        template: { kind: "FORM", rules: { requiredSigner: "VET" } },
      },
      // Not on an appointment, so nothing asks the client for it.
      { id: "inst-n", appointmentId: null, template: clientSigned },
    ]);
    mockedPrisma.formAssignment.findMany.mockResolvedValueOnce([
      { organisationId: "org-1", templateId: "tpl-a", appointmentId: "appt-1" },
      // A request for another form on the same appointment answers nothing.
      { organisationId: "org-1", templateId: "tpl-x", appointmentId: "appt-1" },
    ]);

    const awaiting = await loadDocumentsAwaitingClientSignature([
      form("a"),
      form("b"),
      form("v"),
      form("n"),
      form("k", {
        kind: "CONSENT",
        templateId: null,
        templateInstanceId: null,
      }),
    ]);

    expect([...awaiting].sort()).toEqual(["a", "k"]);
    expect(mockedPrisma.templateInstance.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["inst-a", "inst-b", "inst-v", "inst-n"] } },
      select: {
        id: true,
        appointmentId: true,
        template: { select: { kind: true, rules: true } },
      },
    });
    expect(mockedPrisma.formAssignment.findMany).toHaveBeenCalledWith({
      where: {
        organisationId: { in: ["org-1"] },
        templateId: { in: ["tpl-a", "tpl-b"] },
        appointmentId: { in: ["appt-1"] },
        signingRequired: true,
        status: { notIn: ["CANCELLED", "EXPIRED"] },
      },
      select: { organisationId: true, templateId: true, appointmentId: true },
    });
  });

  // A consent is the client's by default, but its template can name the
  // practice as signer; then staff sign it and the packet may mark it signed.
  it("holds a consent only when its template leaves it to the client", async () => {
    mockedPrisma.templateInstance.findMany.mockResolvedValueOnce([
      {
        id: "inst-c",
        appointmentId: null,
        template: { kind: "CONSENT", rules: null },
      },
      {
        id: "inst-v",
        appointmentId: "appt-1",
        template: { kind: "CONSENT", rules: { requiredSigner: "VET" } },
      },
      {
        id: "inst-l",
        appointmentId: "appt-1",
        template: {
          kind: "FORM",
          rules: { category: "Consent form", requiredSigner: "VET" },
        },
      },
    ]);

    const awaiting = await loadDocumentsAwaitingClientSignature([
      form("c", { kind: "CONSENT" }),
      form("v", { kind: "CONSENT" }),
      form("l", { kind: "CONSENT" }),
    ]);

    // A client-signed consent needs no request for the client to be the one.
    expect([...awaiting]).toEqual(["c"]);
    expect(mockedPrisma.formAssignment.findMany).not.toHaveBeenCalled();
  });

  it("asks for no requests when no form is the client's to sign", async () => {
    mockedPrisma.templateInstance.findMany.mockResolvedValueOnce([
      {
        id: "inst-v",
        appointmentId: "appt-1",
        template: { kind: "FORM", rules: { requiredSigner: "VET" } },
      },
    ]);

    await expect(awaitsClientSignature(form("v"))).resolves.toBe(false);
    expect(mockedPrisma.formAssignment.findMany).not.toHaveBeenCalled();
  });

  it("leaves out a client-signed form nobody asked the client to sign", async () => {
    mockedPrisma.templateInstance.findMany.mockResolvedValueOnce([
      { id: "inst-a", appointmentId: "appt-1", template: clientSigned },
    ]);
    mockedPrisma.formAssignment.findMany.mockResolvedValueOnce([]);

    await expect(awaitsClientSignature(form("a"))).resolves.toBe(false);
  });
});

describe("open and completed signings", () => {
  const minutesAgo = (minutes: number) =>
    new Date(Date.now() - minutes * 60 * 1000).toISOString();

  it.each([
    ["sent to Documenso", { status: "IN_PROGRESS", documentId: "9" }, true],
    [
      "claimed a moment ago",
      { status: "IN_PROGRESS", claimedAt: minutesAgo(1) },
      true,
    ],
    [
      "claimed and abandoned",
      { status: "IN_PROGRESS", claimedAt: minutesAgo(6) },
      false,
    ],
    // Created in Documenso but not yet confirmed sent to the signer.
    [
      "recorded a moment ago, awaiting its send",
      {
        status: "IN_PROGRESS",
        documentId: "9",
        awaitingSend: true,
        claimedAt: minutesAgo(1),
      },
      true,
    ],
    [
      "recorded and never sent",
      {
        status: "IN_PROGRESS",
        documentId: "9",
        awaitingSend: true,
        claimedAt: minutesAgo(6),
      },
      false,
    ],
    [
      "claimed at no readable time",
      { status: "IN_PROGRESS", claimedAt: "x" },
      false,
    ],
    ["claimed at no time", { status: "IN_PROGRESS" }, false],
    ["withdrawn", { status: "NOT_STARTED", documentId: "9" }, false],
    ["absent", null, false],
  ])("reads a signing %s as open: %s", (_label, signing, expected) => {
    expect(isOpenSigning(signing)).toBe(expected);
  });

  it.each([
    ["a signed document", { status: "SIGNED", signing: null }, true],
    [
      "a signing marked signed",
      { status: "DRAFT", signing: { status: "SIGNED" } },
      true,
    ],
    [
      "an open signing",
      { status: "DRAFT", signing: { status: "IN_PROGRESS", documentId: "9" } },
      true,
    ],
    // A claim left by a request that stopped no longer holds the record.
    [
      "an abandoned claim",
      {
        status: "DRAFT",
        signing: { status: "IN_PROGRESS", claimedAt: minutesAgo(10) },
      },
      false,
    ],
    ["no signing", { status: "DRAFT", signing: null }, false],
  ])("holds the record for %s: %s", (_label, document, expected) => {
    expect(hasActiveOrCompletedSigning(document)).toBe(expected);
  });
});
