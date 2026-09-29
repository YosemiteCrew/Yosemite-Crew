import { prisma } from "src/config/prisma";
import {
  awaitsClientSignature,
  hasActiveOrCompletedSigning,
  isConsentTemplate,
  resolveTemplateSigner,
  instanceNeedsClientSignature,
  isOpenSigning,
  requestsAnsweredBy,
  resolveInstanceSigner,
  withdrawalCutoffs,
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

describe("resolveTemplateSigner", () => {
  it.each([
    [{ kind: "FORM", rules: { requiredSigner: "CLIENT" } }, "CLIENT"],
    [{ kind: "FORM", rules: { requiredSigner: " vet " } }, "VET"],
    // A choice of no signature holds even on a consent.
    [{ kind: "CONSENT", rules: { requiredSigner: "NONE" } }, "NONE"],
    [{ kind: "FORM", rules: { requiredSigner: "someone" } }, "NONE"],
    // No choice made: a consent is the client's, any other form no one's.
    [{ kind: "CONSENT", rules: { requiredSigner: "" } }, "CLIENT"],
    [{ kind: "FORM", rules: { category: "Consent form" } }, "CLIENT"],
    [{ kind: "FORM", rules: null }, "NONE"],
  ])("reads %j as signed by %s", (template, expected) => {
    expect(resolveTemplateSigner(template)).toBe(expected);
  });
});

describe("instanceNeedsClientSignature", () => {
  const consent = { kind: "CONSENT", rules: null };
  const vetForm = { kind: "FORM", rules: { requiredSigner: "VET" } };

  it.each([
    [
      "the client pinned on a form now signed by the vet",
      "CLIENT",
      vetForm,
      true,
    ],
    [
      "the vet pinned on a consent now left to the client",
      "VET",
      consent,
      false,
    ],
    ["no one pinned on a consent", "NONE", consent, false],
  ])("follows %s", (_label, signer, template, expected) => {
    expect(
      instanceNeedsClientSignature({ generatedPdf: { signer }, template }),
    ).toBe(expected);
  });

  it.each([
    ["no summary", null],
    ["a summary with no signer", { renderedDocumentId: "doc-1" }],
    ["an unknown signer", { signer: "someone" }],
  ])("falls back to the template with %s", (_label, generatedPdf) => {
    expect(
      instanceNeedsClientSignature({ generatedPdf, template: consent }),
    ).toBe(true);
    expect(
      instanceNeedsClientSignature({ generatedPdf, template: vetForm }),
    ).toBe(false);
  });

  it("is false with neither a pin nor a template", () => {
    expect(
      instanceNeedsClientSignature({ generatedPdf: null, template: null }),
    ).toBe(false);
  });
});

// Which requests a submitted form answers. A practice's answers answer any
// open request; a parent's only one sent at or before them, and none once a
// request was withdrawn after them.
describe("requestsAnsweredBy", () => {
  const answeredAt = new Date("2026-09-20T10:00:00.000Z");
  const instance = (authorId: string | null) => ({
    organisationId: "org-1",
    templateId: "tpl-1",
    appointmentId: "appt-1",
    authorId,
    createdAt: answeredAt,
  });
  const client = (parents: string[], withdrawnSince: number) => ({
    parent: {
      count: jest.fn(async ({ where }: { where: { id: string } }) =>
        parents.includes(where.id) ? 1 : 0,
      ),
    },
    formAssignment: { count: jest.fn(async () => withdrawnSince) },
  });
  const open = {
    organisationId: "org-1",
    templateId: "tpl-1",
    appointmentId: "appt-1",
    status: { notIn: ["CANCELLED", "EXPIRED"] },
  };

  it.each([
    ["the practice", "vet-1"],
    ["no one", null],
  ])("lets answers from %s answer any open request", async (_l, authorId) => {
    const fake = client(["parent-1"], 1);

    await expect(
      requestsAnsweredBy(fake as never, instance(authorId)),
    ).resolves.toEqual(open);
    expect(fake.formAssignment.count).not.toHaveBeenCalled();
  });

  it("lets a parent's answers answer only a request sent by then", async () => {
    const fake = client(["parent-1"], 0);

    await expect(
      requestsAnsweredBy(fake as never, instance("parent-1")),
    ).resolves.toEqual({ ...open, createdAt: { lte: answeredAt } });
    expect(fake.formAssignment.count).toHaveBeenCalledWith({
      where: {
        organisationId: "org-1",
        templateId: "tpl-1",
        appointmentId: "appt-1",
        status: { in: ["CANCELLED", "EXPIRED"] },
        OR: [
          { cancelledAt: { gt: answeredAt } },
          { expiredAt: { gt: answeredAt } },
        ],
      },
    });
  });

  it("answers nothing with a parent's answers to a request withdrawn since", async () => {
    await expect(
      requestsAnsweredBy(
        client(["parent-1"], 1) as never,
        instance("parent-1"),
      ),
    ).resolves.toBeNull();
  });
});

describe("withdrawalCutoffs", () => {
  it("takes the latest withdrawal of each form, cancelled or lapsed", () => {
    expect(
      withdrawalCutoffs([
        { templateId: "a", cancelledAt: new Date("2026-09-20T10:00:00.000Z") },
        { templateId: "a", cancelledAt: "2026-09-21T10:00:00.000Z" },
        { templateId: "b", expiredAt: new Date("2026-09-19T10:00:00.000Z") },
        { templateId: "c", cancelledAt: null, expiredAt: null },
      ]),
    ).toEqual(
      new Map([
        ["a", Date.parse("2026-09-21T10:00:00.000Z")],
        ["b", Date.parse("2026-09-19T10:00:00.000Z")],
      ]),
    );
  });
});

// Who signs a submitted document, for a list that says "No signature required".
describe("resolveInstanceSigner", () => {
  const consent = { kind: "CONSENT", rules: null };

  it.each(["CLIENT", "VET", "NONE"])("reads a pinned %s", (signer) => {
    expect(
      resolveInstanceSigner({
        generatedPdf: { signer },
        template: { kind: "FORM", rules: { requiredSigner: "CLIENT" } },
      }),
    ).toBe(signer);
  });

  it("falls back to the template with nothing pinned", () => {
    expect(
      resolveInstanceSigner({ generatedPdf: null, template: consent }),
    ).toBe("CLIENT");
    expect(
      resolveInstanceSigner({
        generatedPdf: { signer: "someone" },
        template: { kind: "CONSENT", rules: { requiredSigner: "NONE" } },
      }),
    ).toBe("NONE");
  });

  it("has no answer with neither", () => {
    expect(
      resolveInstanceSigner({ generatedPdf: null, template: null }),
    ).toBeNull();
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
        generatedPdf: true,
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

  it("follows the signer pinned when a document was submitted", async () => {
    mockedPrisma.templateInstance.findMany.mockResolvedValueOnce([
      {
        id: "inst-p",
        appointmentId: null,
        generatedPdf: { signer: "VET" },
        template: { kind: "CONSENT", rules: null },
      },
    ]);

    await expect(
      awaitsClientSignature(form("p", { kind: "CONSENT" })),
    ).resolves.toBe(false);
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
