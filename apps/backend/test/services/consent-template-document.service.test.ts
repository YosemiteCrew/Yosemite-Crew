/**
 * #3600: a consent template must produce a CONSENT rendered document that the
 * patient's consent documents list (GET /v1/document/pms/:patientId/consent)
 * returns. This drives the real TemplateService.submitInstance, the real
 * rendered-document create/sign/complete path and the real
 * DocumentService.listConsentDocumentsForPms against one in-memory store, so
 * the kind written on submit is the kind the list filters on.
 */
import { prisma } from "src/config/prisma";
import { AuditTrailService } from "src/services/audit-trail.service";
import { DocumentService } from "src/services/document.service";
import { DocumensoService } from "src/services/documenso.service";
import { renderRenderedDocumentPdfWithMetadata } from "src/services/rendered-document-renderer.service";
import {
  completePersistedRenderedDocumentSigning,
  signPersistedRenderedDocument,
} from "src/services/rendered-document.service";
import { TemplateService } from "src/services/template.service";

type Row = Record<string, unknown>;
type Store = {
  templateInstances: Map<string, Row>;
  renderedDocuments: Map<string, Row>;
  documentSignatures: Row[];
  appointments: Row[];
  patientLinks: Row[];
};

// Everything lives inside the factory: it runs while the imports above are
// being resolved, before any top-level const of this file exists.
jest.mock("src/config/prisma", () => {
  const store: Store = {
    templateInstances: new Map(),
    renderedDocuments: new Map(),
    documentSignatures: [],
    appointments: [],
    patientLinks: [],
  };
  let clock = Date.parse("2026-09-24T09:00:00.000Z");
  const tick = () => new Date((clock += 1000));
  const defined = (data: Row) =>
    Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined),
    );
  const pick = (row: Row, select?: Record<string, boolean>) =>
    select
      ? Object.fromEntries(Object.keys(select).map((key) => [key, row[key]]))
      : row;
  const withSignature = (doc: Row) => ({
    ...doc,
    signature:
      store.documentSignatures.find(
        (signature) => signature.renderedDocumentId === doc.id,
      ) ?? null,
  });
  const linkedInstance = (doc: Row) =>
    typeof doc.templateInstanceId === "string"
      ? store.templateInstances.get(doc.templateInstanceId)
      : undefined;
  // The only link shape loadRenderedDocumentsForPatientRecords builds:
  // { templateInstance | clinicalArtifact: { is: { <field>: { in: ids } } } }.
  const matchesLink = (doc: Row, clause: Row) => {
    const [relation, condition] = Object.entries(clause)[0] as [
      string,
      { is: Record<string, { in: unknown[] }> },
    ];
    const record =
      relation === "templateInstance" ? linkedInstance(doc) : undefined;
    return Boolean(
      record &&
      Object.entries(condition.is).every(([field, filter]) =>
        filter.in.includes(record[field]),
      ),
    );
  };
  const matchesKind = (doc: Row, kind: unknown) => {
    if (kind === undefined) return true;
    if (typeof kind === "string") return doc.kind === kind;
    return doc.kind !== (kind as { not: string }).not;
  };

  const client = {
    templateInstance: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const instance = store.templateInstances.get(where.id);
        return instance ? { ...instance } : null;
      },
      update: async ({
        where,
        data,
        select,
      }: {
        where: { id: string };
        data: Row;
        select?: Record<string, boolean>;
      }) => {
        const next = {
          ...store.templateInstances.get(where.id),
          ...defined(data),
        };
        store.templateInstances.set(where.id, next);
        return pick(next, select);
      },
    },
    renderedDocument: {
      create: async ({ data }: { data: Row }) => {
        const now = tick();
        const doc: Row = {
          templateInstanceId: null,
          clinicalArtifactId: null,
          pdfUrl: null,
          signing: null,
          signedAt: null,
          signedBy: null,
          ...defined(data),
          createdAt: now,
          updatedAt: now,
        };
        store.renderedDocuments.set(doc.id as string, doc);
        return withSignature(doc);
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const doc = store.renderedDocuments.get(where.id);
        return doc ? withSignature(doc) : null;
      },
      update: async ({ where, data }: { where: { id: string }; data: Row }) => {
        const next = {
          ...store.renderedDocuments.get(where.id),
          ...defined(data),
          updatedAt: tick(),
        };
        store.renderedDocuments.set(where.id, next);
        return withSignature(next);
      },
      findMany: async ({ where }: { where: Row & { OR: Row[] } }) =>
        [...store.renderedDocuments.values()]
          .filter(
            (doc) =>
              doc.organisationId === where.organisationId &&
              matchesKind(doc, where.kind) &&
              where.OR.some((clause) => matchesLink(doc, clause)),
          )
          .map((doc) => ({
            ...doc,
            templateInstance: pick(linkedInstance(doc) ?? {}, {
              appointmentId: true,
              encounterId: true,
            }),
            clinicalArtifact: null,
          })),
    },
    documentSignature: {
      create: async ({ data }: { data: Row }) => {
        store.documentSignatures.push(data);
        return data;
      },
    },
    patientOrganisation: {
      findFirst: async ({ where }: { where: Row }) =>
        store.patientLinks.find(
          (link) =>
            link.organisationId === where.organisationId &&
            link.patientId === where.patientId,
        ) ?? null,
    },
    appointment: {
      findMany: async ({
        where,
      }: {
        where: { organisationId: string; patient: { equals: string } };
      }) =>
        store.appointments
          .filter(
            (appointment) =>
              appointment.organisationId === where.organisationId &&
              (appointment.patient as { id: string }).id ===
                where.patient.equals,
          )
          .map((appointment) => ({ id: appointment.id })),
      findUnique: async ({ where }: { where: { id: string } }) =>
        store.appointments.find((appointment) => appointment.id === where.id) ??
        null,
    },
    case: { findMany: async () => [], findUnique: async () => null },
    encounter: { findMany: async () => [], findUnique: async () => null },
  };

  return {
    prisma: {
      ...client,
      $transaction: async (callback: (tx: typeof client) => unknown) =>
        callback(client),
      __store: store,
    },
  };
});

jest.mock("src/services/task-workflow.service", () => ({
  TaskWorkflowService: { launchFromTemplateInstance: jest.fn() },
}));

jest.mock("src/services/documenso.service", () => ({
  DocumensoService: {
    resolveOrganisationApiKey: jest.fn(),
    createDocument: jest.fn(),
    distributeDocument: jest.fn(),
    downloadSignedDocument: jest.fn(),
  },
}));

jest.mock("src/services/rendered-document-renderer.service", () => ({
  renderRenderedDocumentPdfWithMetadata: jest.fn(),
}));

jest.mock("src/services/audit-trail.service", () => ({
  AuditTrailService: { recordSafely: jest.fn() },
}));

jest.mock("src/middlewares/upload", () => ({
  uploadBufferAsFile: jest.fn(),
  deleteFromS3: jest.fn(),
  generatePresignedDownloadUrl: jest.fn(),
}));

const store = (prisma as unknown as { __store: Store }).__store;
const documenso = DocumensoService as jest.Mocked<typeof DocumensoService>;
const renderPdfMock = renderRenderedDocumentPdfWithMetadata as jest.Mock;
const recordAuditMock = AuditTrailService.recordSafely as jest.Mock;

const ORG = "org-1";
const PATIENT = "patient-1";
const APPOINTMENT = "appt-1";

const seedTemplateInstance = (id: string, kind: "CONSENT" | "FORM") => {
  store.templateInstances.set(id, {
    id,
    organisationId: ORG,
    status: "DRAFT",
    authorId: "vet-1",
    signedBy: null,
    templateId: `tpl-${id}`,
    templateVersion: 2,
    generatedPdf: null,
    appointmentId: APPOINTMENT,
    caseId: null,
    encounterId: null,
    template: { id: `tpl-${id}`, kind, ownership: "ORG_TEMPLATE" },
  });
};

const listConsentDocuments = () =>
  DocumentService.listConsentDocumentsForPms({
    patientId: PATIENT,
    organisationId: ORG,
  });

beforeEach(() => {
  jest.clearAllMocks();
  store.templateInstances.clear();
  store.renderedDocuments.clear();
  store.documentSignatures.length = 0;
  store.appointments.splice(0, store.appointments.length, {
    id: APPOINTMENT,
    organisationId: ORG,
    patient: { id: PATIENT },
  });
  store.patientLinks.splice(0, store.patientLinks.length, {
    id: "link-1",
    organisationId: ORG,
    patientId: PATIENT,
    status: "ACTIVE",
  });
});

describe("consent template documents (#3600)", () => {
  it("returns a submitted CONSENT template from the patient's consent documents", async () => {
    seedTemplateInstance("inst-consent", "CONSENT");

    await TemplateService.submitInstance("inst-consent", ORG, "vet-1");

    const documents = await listConsentDocuments();
    expect(documents).toHaveLength(1);
    expect(documents[0]).toMatchObject({
      category: "CONSENT",
      title: "Consent form",
      sourceKind: "TEMPLATE_INSTANCE",
      sourceId: "inst-consent",
      appointmentId: APPOINTMENT,
      templateId: "tpl-inst-consent",
      templateVersion: 2,
      signingStatus: "NOT_STARTED",
      signedAt: null,
      pdfUrl: null,
    });
    expect(store.templateInstances.get("inst-consent")).toMatchObject({
      status: "COMPLETED",
      generatedPdf: expect.objectContaining({
        renderedDocumentId: documents[0].id,
        kind: "CONSENT",
      }),
    });
  });

  it("keeps the document CONSENT through signing and lists it as signed", async () => {
    seedTemplateInstance("inst-consent", "CONSENT");
    await TemplateService.submitInstance("inst-consent", ORG, "vet-1");
    const [submitted] = await listConsentDocuments();

    documenso.resolveOrganisationApiKey.mockResolvedValue("documenso-key");
    renderPdfMock.mockResolvedValue({
      pdf: Buffer.from("%PDF-1.4 consent"),
      pageCount: 1,
      signaturePlacement: {
        pageNumber: 1,
        pageX: 10,
        pageY: 10,
        width: 20,
        height: 5,
      },
    });
    documenso.createDocument.mockResolvedValue({
      id: 4242,
      recipients: [{ token: "recipient-token" }],
    } as never);
    documenso.downloadSignedDocument.mockResolvedValue({
      downloadUrl: "https://files.example/signed-consent.pdf",
    } as never);

    await signPersistedRenderedDocument({
      renderedDocumentId: submitted.id as string,
      organisationId: ORG,
      signerId: "vet-1",
      signerType: "PMS_USER",
      signerEmail: "vet@example.com",
      signerName: "Vet One",
    });
    await completePersistedRenderedDocumentSigning(submitted.id as string);

    expect(renderPdfMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Consent form",
        source: expect.objectContaining({
          sourceKind: "TEMPLATE_INSTANCE",
          templateKind: "CONSENT",
        }),
      }),
    );

    const [signed] = await listConsentDocuments();
    expect(signed).toMatchObject({
      id: submitted.id,
      category: "CONSENT",
      signingStatus: "SIGNED",
      pdfUrl: "https://files.example/signed-consent.pdf",
      pmsVisible: true,
    });
    expect(signed.signedAt).toEqual(expect.any(String));
    expect(store.templateInstances.get("inst-consent")?.status).toBe("SIGNED");
    expect(recordAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: ORG,
        patientId: PATIENT,
        eventType: "CONSENT_FORM_SIGNED",
        metadata: { renderedDocumentId: submitted.id, kind: "CONSENT" },
      }),
    );
  });

  it("still renders a FORM template as a FORM document the consent list leaves out", async () => {
    seedTemplateInstance("inst-form", "FORM");

    await TemplateService.submitInstance("inst-form", ORG, "vet-1");

    const stored = [...store.renderedDocuments.values()];
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      kind: "FORM",
      title: "Form submission",
      templateInstanceId: "inst-form",
    });
    await expect(listConsentDocuments()).resolves.toEqual([]);
  });
});
