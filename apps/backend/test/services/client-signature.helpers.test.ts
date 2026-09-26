import { prisma } from "src/config/prisma";
import {
  awaitsClientSignature,
  hasActiveOrCompletedSigning,
  isConsentTemplate,
  isOpenSigning,
  lockClientRequest,
  templateNeedsClientSignature,
} from "../../src/services/client-signature.helpers";

jest.mock("src/config/prisma", () => ({
  prisma: {
    templateInstance: { findUnique: jest.fn() },
    formAssignment: { count: jest.fn() },
  },
}));

const mockedPrisma = prisma as unknown as {
  templateInstance: { findUnique: jest.Mock };
  formAssignment: { count: jest.Mock };
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

describe("awaitsClientSignature", () => {
  const formDocument = {
    kind: "FORM",
    organisationId: "org-1",
    templateId: "tpl-1",
    templateInstanceId: "inst-1",
  };

  it("holds every consent for the client", async () => {
    await expect(
      awaitsClientSignature({
        ...formDocument,
        kind: "CONSENT",
        templateId: null,
        templateInstanceId: null,
      }),
    ).resolves.toBe(true);
    expect(mockedPrisma.templateInstance.findUnique).not.toHaveBeenCalled();
  });

  it.each([
    ["no template", { templateId: null }],
    ["no template instance", { templateInstanceId: null }],
  ])("is false for a form with %s", async (_label, change) => {
    await expect(
      awaitsClientSignature({ ...formDocument, ...change }),
    ).resolves.toBe(false);
    expect(mockedPrisma.templateInstance.findUnique).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", null],
    [
      "not on an appointment",
      { appointmentId: null, template: { kind: "FORM", rules: null } },
    ],
    [
      "from a template the practice signs",
      {
        appointmentId: "appt-1",
        template: { kind: "FORM", rules: { requiredSigner: "VET" } },
      },
    ],
  ])("is false when its record is %s", async (_label, instance) => {
    mockedPrisma.templateInstance.findUnique.mockResolvedValueOnce(instance);

    await expect(awaitsClientSignature(formDocument)).resolves.toBe(false);
    expect(mockedPrisma.formAssignment.count).not.toHaveBeenCalled();
  });

  it.each([
    [1, true],
    [0, false],
  ])(
    "for a client-signed form, follows the requests asking for it (%i)",
    async (requests, expected) => {
      mockedPrisma.templateInstance.findUnique.mockResolvedValueOnce({
        appointmentId: "appt-1",
        template: { kind: "FORM", rules: { requiredSigner: "CLIENT" } },
      });
      mockedPrisma.formAssignment.count.mockResolvedValueOnce(requests);

      await expect(awaitsClientSignature(formDocument)).resolves.toBe(expected);
      expect(mockedPrisma.formAssignment.count).toHaveBeenCalledWith({
        where: {
          organisationId: "org-1",
          templateId: "tpl-1",
          appointmentId: "appt-1",
          signingRequired: true,
          status: { notIn: ["CANCELLED", "EXPIRED"] },
        },
      });
    },
  );
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
