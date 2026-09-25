/**
 * #3600: every way a consent template is submitted must leave a CONSENT
 * rendered document that the patient's consent documents list
 * (GET /v1/document/pms/:patientId/consent) returns. This drives the real
 * FormService.submitFHIR (the mobile and PMS form submit routes), the real
 * TemplateService.createInstance/submitInstance, the real TaskWorkflowService,
 * the real rendered-document create/sign/complete path and the real
 * DocumentService.listConsentDocumentsForPms against one in-memory store, so
 * the kind written on submit is the kind the list filters on.
 */
import {
  toFormSubmissionResponseDTO,
  type FormSubmission,
} from "@yosemite-crew/types";
import { prisma } from "src/config/prisma";
import { AuditTrailService } from "src/services/audit-trail.service";
import { DocumentService } from "src/services/document.service";
import { DocumensoService } from "src/services/documenso.service";
import { FormService } from "src/services/form.service";
import { renderRenderedDocumentPdfWithMetadata } from "src/services/rendered-document-renderer.service";
import {
  completePersistedRenderedDocumentSigning,
  signPersistedRenderedDocument,
} from "src/services/rendered-document.service";
import { TemplateService } from "src/services/template.service";
import { FormAssignmentService } from "src/services/form-assignment.service";
import { FormSigningService } from "src/services/formSigning.service";

type Row = Record<string, unknown>;
type Store = {
  templates: Map<string, Row>;
  templateVersions: Row[];
  templateInstances: Map<string, Row>;
  renderedDocuments: Map<string, Row>;
  documentSignatures: Row[];
  appointments: Row[];
  patientLinks: Row[];
  parentLinks: Row[];
  formAssignments: Row[];
};

// Everything lives inside the factory: it runs while the imports above are
// being resolved, before any top-level const of this file exists.
jest.mock("src/config/prisma", () => {
  const store: Store = {
    templates: new Map(),
    templateVersions: [],
    templateInstances: new Map(),
    renderedDocuments: new Map(),
    documentSignatures: [],
    appointments: [],
    patientLinks: [],
    parentLinks: [],
    formAssignments: [],
  };
  let clock = Date.parse("2026-09-24T09:00:00.000Z");
  let instanceSequence = 0;
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
  // The where shapes the services under test use: equality, in / notIn / not,
  // a JSON path, a timestamp, OR and AND.
  const matches = (row: Row, where: Row = {}): boolean =>
    Object.entries(where).every(([key, condition]) => {
      if (condition === undefined) return true;
      if (key === "OR") {
        return (condition as Row[]).some((clause) => matches(row, clause));
      }
      if (key === "AND") {
        return (condition as Row[]).every((clause) => matches(row, clause));
      }
      const value = row[key];
      if (
        condition &&
        typeof condition === "object" &&
        "gt" in (condition as Record<string, unknown>)
      ) {
        const bound = (condition as { gt: Date }).gt;
        return value instanceof Date && value.getTime() > bound.getTime();
      }
      if (condition instanceof Date) {
        return value instanceof Date && value.getTime() === condition.getTime();
      }
      if (condition && typeof condition === "object") {
        const clause = condition as Record<string, unknown>;
        if ("in" in clause) return (clause.in as unknown[]).includes(value);
        if ("notIn" in clause) {
          return !(clause.notIn as unknown[]).includes(value);
        }
        if ("not" in clause) return value !== clause.not;
        if ("path" in clause) {
          const found = (clause.path as string[]).reduce<unknown>(
            (node, part) => (node as Row | null | undefined)?.[part],
            value,
          );
          return found === clause.equals;
        }
      }
      return value === condition;
    });
  const notFound = () => {
    const { Prisma } = jest.requireActual("@prisma/client");
    return new Prisma.PrismaClientKnownRequestError("No record was found.", {
      code: "P2025",
      clientVersion: "test",
    });
  };
  const withAppointment = (assignment: Row) => ({
    ...assignment,
    appointment:
      store.appointments.find(
        (appointment) => appointment.id === assignment.appointmentId,
      ) ?? null,
  });
  const findVersion = (templateId: unknown, version: unknown) =>
    store.templateVersions.find(
      (row) => row.templateId === templateId && row.version === version,
    ) ?? null;

  const client = {
    template: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const template = store.templates.get(where.id);
        return template
          ? {
              ...template,
              versions: store.templateVersions.filter(
                (row) => row.templateId === where.id,
              ),
              catalogLinks: [],
            }
          : null;
      },
    },
    templateVersion: {
      findFirst: async ({ where }: { where: Row }) =>
        findVersion(where.templateId, where.version),
      findUnique: async ({
        where,
      }: {
        where: { templateId_version: { templateId: string; version: number } };
      }) =>
        findVersion(
          where.templateId_version.templateId,
          where.templateId_version.version,
        ),
    },
    // No concrete form ever exists here, so every submission resolves to a
    // template, the way a template-backed form does in production.
    form: { findUnique: async () => null },
    formSubmission: { findUnique: async () => null },
    formVersion: { findFirst: async () => null },
    templateInstance: {
      create: async ({ data }: { data: Row }) => {
        const id = `inst-${++instanceSequence}`;
        const instance: Row = {
          id,
          caseId: null,
          encounterId: null,
          appointmentId: null,
          authorId: null,
          signedBy: null,
          signedAt: null,
          generatedPdf: null,
          generatedPdfUrl: null,
          status: "DRAFT",
          ...defined(data),
          createdAt: tick(),
          updatedAt: tick(),
        };
        store.templateInstances.set(id, instance);
        return { ...instance };
      },
      findUnique: async ({
        where,
        include,
        select,
      }: {
        where: { id: string };
        include?: {
          template?: { select: Record<string, boolean> };
          taskSchedule?: boolean;
        };
        select?: Record<string, boolean>;
      }) => {
        const instance = store.templateInstances.get(where.id);
        if (!instance) return null;
        if (select) return pick(instance, select);
        const template = store.templates.get(instance.templateId as string);
        return {
          ...instance,
          ...(include?.template && template
            ? { template: pick(template, include.template.select) }
            : {}),
          ...(include?.taskSchedule ? { taskSchedule: null } : {}),
        };
      },
      update: async ({
        where,
        data,
        select,
      }: {
        where: Row & { id: string };
        data: Row;
        select?: Record<string, boolean>;
      }) => {
        const current = store.templateInstances.get(where.id);
        if (!current || !matches(current, where)) throw notFound();
        const next = { ...current, ...defined(data), updatedAt: tick() };
        store.templateInstances.set(where.id, next);
        return pick(next, select);
      },
      // The submit claim and the signing completion's guarded move. Nothing
      // awaits between the read and the write, so it is as atomic here as a
      // row-locked UPDATE is in Postgres.
      updateMany: async ({
        where,
        data,
      }: {
        where: Row & { id: string };
        data: Row;
      }) => {
        const instance = store.templateInstances.get(where.id);
        if (!instance || !matches(instance, where)) {
          return { count: 0 };
        }
        store.templateInstances.set(where.id, {
          ...instance,
          ...defined(data),
          updatedAt: tick(),
        });
        return { count: 1 };
      },
      count: async ({ where }: { where: Row }) =>
        [...store.templateInstances.values()].filter((instance) =>
          matches(instance, where),
        ).length,
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
        const instance = store.templateInstances.get(where.id);
        if (!instance) throw new Error("No TemplateInstance found");
        return { ...instance };
      },
      // The form routes' "one instance per template per appointment" lookup.
      findMany: async ({
        where,
        select,
      }: {
        where: Row;
        select?: Record<string, boolean>;
      }) =>
        [...store.templateInstances.values()]
          .filter((instance) => matches(instance, where))
          .map((instance) => pick(instance, select)),
    },
    renderedDocument: {
      // RenderedDocument.templateInstanceId is @unique, so a second document
      // for one instance fails here the way it fails in Postgres.
      create: async ({ data }: { data: Row }) => {
        const clash = [...store.renderedDocuments.values()].some(
          (doc) =>
            data.templateInstanceId !== undefined &&
            doc.templateInstanceId === data.templateInstanceId,
        );
        if (clash) {
          throw new Error(
            "Unique constraint failed on the fields: (`templateInstanceId`)",
          );
        }
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
      findUnique: async ({
        where,
        select,
      }: {
        where: { id?: string; templateInstanceId?: string };
        select?: Record<string, boolean>;
      }) => {
        const doc = [...store.renderedDocuments.values()].find((row) =>
          matches(row, where),
        );
        if (!doc) return null;
        return select ? pick(doc, select) : withSignature(doc);
      },
      // The signing claim and its release.
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        const { Prisma } = jest.requireActual("@prisma/client");
        let count = 0;
        for (const [id, doc] of store.renderedDocuments) {
          if (!matches(doc, where)) continue;
          store.renderedDocuments.set(id, {
            ...doc,
            ...defined(data),
            ...(data.signing === Prisma.DbNull ? { signing: null } : {}),
            updatedAt: tick(),
          });
          count += 1;
        }
        return { count };
      },
      update: async ({
        where,
        data,
      }: {
        where: Row & { id: string };
        data: Row;
      }) => {
        const current = store.renderedDocuments.get(where.id);
        if (!current || !matches(current, where)) throw notFound();
        const next = { ...current, ...defined(data), updatedAt: tick() };
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
          .map((doc) => {
            const instance = linkedInstance(doc) ?? {};
            const template = store.templates.get(instance.templateId as string);
            return {
              ...doc,
              templateInstance: {
                ...pick(instance, {
                  appointmentId: true,
                  encounterId: true,
                  status: true,
                }),
                template: template ? { rules: template.rules } : null,
              },
              clinicalArtifact: null,
            };
          }),
    },
    documentSignature: {
      upsert: async ({ create }: { create: Row }) => {
        store.documentSignatures.push(create);
        return create;
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
    parentPatient: {
      findFirst: async ({ where }: { where: Row }) =>
        store.parentLinks.find(
          (link) =>
            link.parentId === where.parentId &&
            link.patientId === where.patientId,
        ) ?? null,
      findMany: async ({ where }: { where: Row }) =>
        store.parentLinks.filter((link) => link.parentId === where.parentId),
    },
    // No uploaded documents: only rendered ones are under test.
    document: { findMany: async () => [] },
    formAssignment: {
      findMany: async ({ where }: { where: Row }) =>
        store.formAssignments
          .filter((assignment) => matches(assignment, where))
          .map(withAppointment),
      findFirst: async ({ where }: { where: Row }) =>
        store.formAssignments.find((assignment) =>
          matches(assignment, where),
        ) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Row }) => {
        const index = store.formAssignments.findIndex(
          (assignment) => assignment.id === where.id,
        );
        store.formAssignments[index] = {
          ...store.formAssignments[index],
          ...defined(data),
        };
        return store.formAssignments[index];
      },
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        let count = 0;
        store.formAssignments.forEach((assignment, index) => {
          if (!matches(assignment, where)) return;
          store.formAssignments[index] = { ...assignment, ...defined(data) };
          count += 1;
        });
        return { count };
      },
    },
    parent: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id === "parent-1"
          ? { email: "owner@example.com", firstName: "Jane", lastName: "Owner" }
          : null,
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
      findFirst: async ({ where }: { where: Row }) =>
        store.appointments.find(
          (appointment) =>
            appointment.id === where.id &&
            appointment.organisationId === where.organisationId,
        ) ?? null,
      // Attaching the form id to the appointment is not under test.
      updateMany: async () => ({ count: 1 }),
      findUnique: async ({ where }: { where: { id: string } }) =>
        store.appointments.find((appointment) => appointment.id === where.id) ??
        null,
    },
    case: { findMany: async () => [], findUnique: async () => null },
    encounter: { findMany: async () => [], findUnique: async () => null },
  };

  // pg_advisory_xact_lock: a second holder of the same key waits until the
  // first transaction ends.
  const locks = new Map<string, Promise<void>>();
  const $transaction = async (callback: (tx: unknown) => unknown) => {
    const releases: Array<() => void> = [];
    const tx = {
      ...client,
      $executeRaw: async (_sql: TemplateStringsArray, key: string) => {
        const previous = locks.get(key) ?? Promise.resolve();
        let release: () => void = () => undefined;
        const held = new Promise<void>((resolve) => {
          release = resolve;
        });
        locks.set(
          key,
          previous.then(() => held),
        );
        await previous;
        releases.push(release);
        return 1;
      },
    };
    try {
      return await callback(tx);
    } finally {
      releases.forEach((release) => release());
    }
  };

  return {
    prisma: {
      ...client,
      $transaction,
      __store: store,
    },
  };
});

jest.mock("src/services/formPDF.service", () => ({
  buildPdfViewModel: jest.fn(),
  renderPdf: jest.fn(),
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
const PARENT = "parent-1";
const APPOINTMENT = "appt-1";

type StorageKind =
  | "FORM"
  | "CONSENT"
  | "SOAP_NOTE"
  | "PRESCRIPTION"
  | "DISCHARGE_SUMMARY"
  | "VITAL_RECORD";

const seedTemplate = (
  id: string,
  kind: StorageKind,
  options: {
    name?: string;
    category?: string;
    // The builder's usage choice, which it writes to rules.visibility.
    visibility?: string;
    // Whether the practice sent it to the client for the appointment.
    assigned?: boolean;
  } = {},
) => {
  store.templates.set(id, {
    id,
    organisationId: ORG,
    ownerUserId: null,
    ownership: "ORG_TEMPLATE",
    kind,
    name: options.name ?? `${kind} template`,
    status: "PUBLISHED",
    // What the form builder writes (buildTemplatePayload): the author's
    // category, which for consent was "Consent form" long before CONSENT
    // became a storage kind.
    rules:
      options.category || options.visibility
        ? { category: options.category, visibility: options.visibility }
        : null,
    latestVersion: 2,
    publishedVersion: 2,
  });
  store.templateVersions.push({
    id: `${id}-v2`,
    templateId: id,
    version: 2,
    schemaSnapshot: { sections: [] },
  });
  if (options.assigned === false) return;
  store.formAssignments.push({
    id: `assignment-${id}`,
    organisationId: ORG,
    templateId: id,
    templateVersion: 2,
    appointmentId: APPOINTMENT,
    companionId: PATIENT,
    signingRequired: true,
    status: "SENT",
  });
};

// The instance the PMS template-instance routes create before submitting it.
const seedTemplateInstance = (
  id: string,
  templateId: string,
  authorId: string | null = "vet-1",
) => {
  const at = new Date("2026-09-24T08:30:00.000Z");
  store.templateInstances.set(id, {
    id,
    organisationId: ORG,
    status: "DRAFT",
    authorId,
    createdAt: at,
    updatedAt: at,
    signedBy: null,
    templateId,
    templateVersion: 2,
    generatedPdf: null,
    appointmentId: APPOINTMENT,
    caseId: null,
    encounterId: null,
  });
};

const questionnaireResponse = (templateId: string) =>
  toFormSubmissionResponseDTO({
    _id: "",
    formId: templateId,
    formVersion: 2,
    appointmentId: APPOINTMENT,
    companionId: PATIENT,
    parentId: PARENT,
    answers: { agree: "yes" },
    submittedAt: new Date("2026-09-24T08:00:00.000Z"),
  } as FormSubmission);

// POST /fhir/v1/form/mobile/forms/:formId/submit, as the pet parent.
const submitFromMobile = (templateId: string) =>
  FormService.submitFHIR(questionnaireResponse(templateId), undefined, PARENT, {
    parentId: PARENT,
  });

// POST /fhir/v1/form/admin/:formId/submit, as a PMS user of the organisation.
const submitFromPms = (templateId: string) =>
  FormService.submitFHIR(
    questionnaireResponse(templateId),
    undefined,
    "vet-1",
    {
      organisationId: ORG,
    },
  );

const listConsentDocuments = () =>
  DocumentService.listConsentDocumentsForPms({
    patientId: PATIENT,
    organisationId: ORG,
  });

const armDocumenso = () => {
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
};

// Practice staff sign clinical documents; only the client signs a consent.
const VET_SIGNER = {
  signerId: "vet-1",
  signerType: "PMS_USER" as const,
  signerEmail: "vet@example.com",
  signerName: "Vet One",
};
const CLIENT_SIGNER = {
  signerId: PARENT,
  signerType: "PARENT" as const,
  signerEmail: "owner@example.com",
  signerName: "Jane Owner",
};

const signAndComplete = async (
  renderedDocumentId: string,
  signer: typeof VET_SIGNER | typeof CLIENT_SIGNER = VET_SIGNER,
) => {
  armDocumenso();
  await signPersistedRenderedDocument({
    renderedDocumentId,
    organisationId: ORG,
    ...signer,
  });
  await completePersistedRenderedDocumentSigning(renderedDocumentId);
};

beforeEach(() => {
  jest.clearAllMocks();
  store.templates.clear();
  store.templateVersions.length = 0;
  store.templateInstances.clear();
  store.renderedDocuments.clear();
  store.documentSignatures.length = 0;
  store.formAssignments.length = 0;
  store.appointments.splice(0, store.appointments.length, {
    id: APPOINTMENT,
    organisationId: ORG,
    patient: { id: PATIENT, parent: { id: PARENT } },
  });
  store.patientLinks.splice(0, store.patientLinks.length, {
    id: "link-1",
    organisationId: ORG,
    patientId: PATIENT,
    status: "ACTIVE",
  });
  store.parentLinks.splice(0, store.parentLinks.length, {
    parentId: PARENT,
    patientId: PATIENT,
    role: "PRIMARY",
    permissions: {},
  });
});

describe("consent template documents (#3600)", () => {
  describe("PMS template-instance submit", () => {
    it("returns a submitted CONSENT template from the patient's consent documents", async () => {
      seedTemplate("tpl-consent", "CONSENT", { name: "Anaesthesia consent" });
      seedTemplateInstance("inst-consent", "tpl-consent");

      await TemplateService.submitInstance("inst-consent", ORG, "vet-1");

      const documents = await listConsentDocuments();
      expect(documents).toHaveLength(1);
      expect(documents[0]).toMatchObject({
        category: "CONSENT",
        title: "Anaesthesia consent",
        sourceKind: "TEMPLATE_INSTANCE",
        sourceId: "inst-consent",
        appointmentId: APPOINTMENT,
        templateId: "tpl-consent",
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
      seedTemplate("tpl-consent", "CONSENT", { name: "Anaesthesia consent" });
      seedTemplateInstance("inst-consent", "tpl-consent");
      await TemplateService.submitInstance("inst-consent", ORG, "vet-1");
      const [submitted] = await listConsentDocuments();

      await signAndComplete(submitted.id as string, CLIENT_SIGNER);

      expect(renderPdfMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Anaesthesia consent",
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
      expect(store.templateInstances.get("inst-consent")?.status).toBe(
        "SIGNED",
      );
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
      seedTemplate("tpl-form", "FORM", { category: "Custom" });
      seedTemplateInstance("inst-form", "tpl-form");

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

  // Both form submit routes write a template-backed submission as a template
  // instance (FormService.submitViaTemplateInstance). They used to set it
  // COMPLETED directly, which rendered no document for any template kind.
  describe.each([
    ["mobile (pet parent)", submitFromMobile],
    ["PMS form submit", submitFromPms],
  ])("%s", (_route, submit) => {
    it.each([
      ["a CONSENT template", "CONSENT" as const, undefined],
      // Saved before CONSENT was a storage kind: stored as FORM, and only its
      // rules.category still says it is a consent.
      ["a consent template stored as FORM", "FORM" as const, "Consent form"],
    ])(
      "lists %s in the patient's consent documents",
      async (_label, kind, category) => {
        seedTemplate("tpl-consent", kind, {
          name: "Dental procedure consent",
          category,
        });

        const submission = await submit("tpl-consent");

        const documents = await listConsentDocuments();
        expect(documents).toHaveLength(1);
        expect(documents[0]).toMatchObject({
          category: "CONSENT",
          title: "Dental procedure consent",
          sourceKind: "TEMPLATE_INSTANCE",
          sourceId: submission._id,
          appointmentId: APPOINTMENT,
          templateId: "tpl-consent",
          templateVersion: 2,
          signingStatus: "NOT_STARTED",
        });
        expect(store.templateInstances.get(submission._id)).toMatchObject({
          status: "COMPLETED",
          data: { agree: "yes" },
          generatedPdf: expect.objectContaining({
            renderedDocumentId: documents[0].id,
            kind: "CONSENT",
          }),
        });
      },
    );

    it.each([
      "FORM",
      "SOAP_NOTE",
      "PRESCRIPTION",
      "DISCHARGE_SUMMARY",
      "VITAL_RECORD",
    ] as const)(
      "renders a %s template as a document of its own kind",
      async (kind) => {
        seedTemplate("tpl-doc", kind, { category: "Custom" });

        const submission = await submit("tpl-doc");

        const stored = [...store.renderedDocuments.values()];
        expect(stored).toHaveLength(1);
        expect(stored[0]).toMatchObject({
          kind,
          templateInstanceId: submission._id,
          templateId: "tpl-doc",
        });
        expect(store.templateInstances.get(submission._id)?.status).toBe(
          "COMPLETED",
        );
        await expect(listConsentDocuments()).resolves.toEqual([]);
      },
    );
  });

  it("renders one document however many times the instance is submitted", async () => {
    seedTemplate("tpl-consent", "CONSENT", { name: "Anaesthesia consent" });
    const submission = await submitFromMobile("tpl-consent");

    await TemplateService.submitInstance(submission._id, ORG, "vet-1");
    const [document] = await listConsentDocuments();
    await signAndComplete(document.id as string, CLIENT_SIGNER);
    await TemplateService.submitInstance(submission._id, ORG, "vet-1");

    expect(store.renderedDocuments.size).toBe(1);
    expect(store.templateInstances.get(submission._id)?.status).toBe("SIGNED");
    await expect(listConsentDocuments()).resolves.toEqual([
      expect.objectContaining({ id: document.id, signingStatus: "SIGNED" }),
    ]);
  });

  // Two submits of one instance that both read it as DRAFT: the second used to
  // fail on the unique RenderedDocument.templateInstanceId and surface a 500.
  it("renders one document when the same instance is submitted twice at once", async () => {
    seedTemplate("tpl-consent", "CONSENT", { name: "Anaesthesia consent" });
    seedTemplateInstance("inst-consent", "tpl-consent");

    const results = await Promise.all([
      TemplateService.submitInstance("inst-consent", ORG, "vet-1"),
      TemplateService.submitInstance("inst-consent", ORG, "vet-1"),
    ]);

    expect(results.map(({ id, status }) => [id, status])).toEqual([
      ["inst-consent", "COMPLETED"],
      ["inst-consent", "COMPLETED"],
    ]);
    expect(store.renderedDocuments.size).toBe(1);
    await expect(listConsentDocuments()).resolves.toHaveLength(1);
  });

  it("refuses to submit a void instance and renders nothing for it", async () => {
    seedTemplate("tpl-consent", "CONSENT", { name: "Anaesthesia consent" });
    seedTemplateInstance("inst-void", "tpl-consent");
    store.templateInstances.get("inst-void")!.status = "VOID";

    await expect(
      TemplateService.submitInstance("inst-void", ORG, "vet-1"),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(store.renderedDocuments.size).toBe(0);
    expect(store.templateInstances.get("inst-void")?.status).toBe("VOID");
  });

  describe("resubmitting on the mobile (pet parent) route", () => {
    it("is refused and renders no second document", async () => {
      seedTemplate("tpl-consent", "CONSENT", { name: "Anaesthesia consent" });
      const first = await submitFromMobile("tpl-consent");

      await expect(submitFromMobile("tpl-consent")).rejects.toMatchObject({
        statusCode: 409,
      });

      expect([...store.templateInstances.keys()]).toEqual([first._id]);
      expect(store.renderedDocuments.size).toBe(1);
    });

    it("is refused once the submitted consent is signed", async () => {
      seedTemplate("tpl-consent", "CONSENT", { name: "Anaesthesia consent" });
      await submitFromMobile("tpl-consent");
      const [document] = await listConsentDocuments();
      await signAndComplete(document.id as string, CLIENT_SIGNER);

      await expect(submitFromMobile("tpl-consent")).rejects.toMatchObject({
        statusCode: 409,
      });

      expect(store.renderedDocuments.size).toBe(1);
    });

    it("submits the parent's own instance a failed submit left open", async () => {
      seedTemplate("tpl-consent", "CONSENT", { name: "Anaesthesia consent" });
      seedTemplateInstance("inst-open", "tpl-consent", PARENT);

      const submission = await submitFromMobile("tpl-consent");

      expect(submission._id).toBe("inst-open");
      expect([...store.templateInstances.keys()]).toEqual(["inst-open"]);
      expect(store.templateInstances.get("inst-open")).toMatchObject({
        status: "COMPLETED",
        data: { agree: "yes" },
      });
      expect(store.renderedDocuments.size).toBe(1);
    });

    // The practice's draft is theirs: a parent's answers never merge into it.
    it.each([
      ["a practice draft", "vet-1"],
      ["an unowned draft a package expansion left", null],
    ])("leaves %s alone", async (_label, authorId) => {
      seedTemplate("tpl-consent", "CONSENT", { name: "Anaesthesia consent" });
      seedTemplateInstance("inst-staff", "tpl-consent", authorId);

      const submission = await submitFromMobile("tpl-consent");

      expect(submission._id).not.toBe("inst-staff");
      expect(store.templateInstances.get("inst-staff")).toMatchObject({
        status: "DRAFT",
        authorId,
      });
      expect(store.templateInstances.get(submission._id)).toMatchObject({
        status: "COMPLETED",
        authorId: PARENT,
        data: { agree: "yes" },
      });
    });

    // The submission was recorded but its assignment was not updated; the
    // parent used to be refused for good while the practice saw the consent as
    // still outstanding.
    it("finishes the assignment of a recorded submission on retry", async () => {
      seedTemplate("tpl-consent", "CONSENT", { name: "Anaesthesia consent" });
      const first = await submitFromMobile("tpl-consent");
      store.formAssignments[0].status = "SENT";

      const retry = await submitFromMobile("tpl-consent");

      expect(retry._id).toBe(first._id);
      expect(store.templateInstances.size).toBe(1);
      expect(store.renderedDocuments.size).toBe(1);
      expect(store.formAssignments[0].status).toBe("SUBMITTED");
    });
  });

  // A double tap on Submit: the second waits for the first and goes on with
  // its submission, so one instance and one document exist.
  it("records one submission when a parent submits twice at once", async () => {
    seedTemplate("tpl-consent", "CONSENT", { name: "Anaesthesia consent" });

    const [first, second] = await Promise.all([
      submitFromMobile("tpl-consent"),
      submitFromMobile("tpl-consent"),
    ]);

    expect(second._id).toBe(first._id);
    expect(store.templateInstances.size).toBe(1);
    expect(store.renderedDocuments.size).toBe(1);
  });

  // Staff may save a template again, so the second of two saves at once is a
  // second save: it waits its turn and records its own instance, never a
  // failure part-way.
  it("records each of two staff saves made at once in full", async () => {
    seedTemplate("tpl-consent", "CONSENT", { name: "Anaesthesia consent" });

    const [first, second] = await Promise.all([
      submitFromPms("tpl-consent"),
      submitFromPms("tpl-consent"),
    ]);

    expect(second._id).not.toBe(first._id);
    expect(
      [...store.templateInstances.values()].map(({ status }) => status),
    ).toEqual(["COMPLETED", "COMPLETED"]);
    expect(store.renderedDocuments.size).toBe(2);
  });

  describe("saving again on the PMS form submit route", () => {
    // A practice may fill the same template twice on one visit.
    it.each(["COMPLETED", "SIGNED"])(
      "creates another instance once the first is %s",
      async (status) => {
        seedTemplate("tpl-form", "FORM", { category: "Custom" });
        const first = await submitFromPms("tpl-form");
        store.templateInstances.get(first._id)!.status = status;

        const second = await submitFromPms("tpl-form");

        expect(second._id).not.toBe(first._id);
        expect(store.templateInstances.get(first._id)?.status).toBe(status);
        expect(store.templateInstances.get(second._id)?.status).toBe(
          "COMPLETED",
        );
        expect(store.renderedDocuments.size).toBe(2);
      },
    );

    it.each([
      ["the staff member's own", "vet-1"],
      ["an unowned package expansion", null],
    ])("submits %s open instance", async (_label, authorId) => {
      seedTemplate("tpl-consent", "CONSENT", { name: "Anaesthesia consent" });
      seedTemplateInstance("inst-open", "tpl-consent", authorId);

      const submission = await submitFromPms("tpl-consent");

      expect(submission._id).toBe("inst-open");
      expect([...store.templateInstances.keys()]).toEqual(["inst-open"]);
      expect(store.templateInstances.get("inst-open")).toMatchObject({
        status: "COMPLETED",
        data: { agree: "yes" },
      });
      expect(store.renderedDocuments.size).toBe(1);
    });

    it("never takes over the parent's submission", async () => {
      seedTemplate("tpl-consent", "CONSENT", { name: "Anaesthesia consent" });
      seedTemplateInstance("inst-parent", "tpl-consent", PARENT);

      const submission = await submitFromPms("tpl-consent");

      expect(submission._id).not.toBe("inst-parent");
      expect(store.templateInstances.get("inst-parent")?.status).toBe("DRAFT");
    });
  });

  it.each([
    ["mobile (pet parent)", submitFromMobile],
    ["PMS form submit", submitFromPms],
  ])(
    "leaves a void instance alone on the %s route and submits a new one",
    async (_route, submit) => {
      seedTemplate("tpl-consent", "CONSENT", { name: "Anaesthesia consent" });
      seedTemplateInstance("inst-void", "tpl-consent");
      store.templateInstances.get("inst-void")!.status = "VOID";

      const submission = await submit("tpl-consent");

      expect(submission._id).not.toBe("inst-void");
      expect(store.templateInstances.get("inst-void")?.status).toBe("VOID");
      expect(store.templateInstances.get(submission._id)?.status).toBe(
        "COMPLETED",
      );
      expect(store.renderedDocuments.size).toBe(1);
    },
  );

  // What the finalisation gate reads: an assignment still pending blocks it.
  describe("the client's signature on a consent they were sent", () => {
    const formSummaries = () =>
      FormAssignmentService.listAppointmentFormSummaries(ORG, APPOINTMENT);

    const documensoUrl = process.env.DOCUMENSO_URL;
    beforeEach(() => {
      process.env.DOCUMENSO_URL = "https://sign.example";
    });
    afterEach(() => {
      if (documensoUrl === undefined) delete process.env.DOCUMENSO_URL;
      else process.env.DOCUMENSO_URL = documensoUrl;
    });

    it("is started from the app and lets the visit be finalised", async () => {
      seedTemplate("tpl-consent", "CONSENT", { name: "Anaesthesia consent" });
      const submission = await submitFromMobile("tpl-consent");
      await expect(formSummaries()).resolves.toEqual([
        expect.objectContaining({
          status: "pending",
          assignmentStatus: "submitted",
        }),
      ]);
      armDocumenso();

      const started = await FormSigningService.startSigning({
        isParent: true,
        submissionId: submission._id,
        initiatedBy: PARENT,
      });

      expect(started).toEqual({
        documentId: "4242",
        signingUrl: "https://sign.example/sign/recipient-token",
      });
      expect(documenso.createDocument).toHaveBeenLastCalledWith(
        expect.objectContaining({ signerEmail: "owner@example.com" }),
      );
      await expect(formSummaries()).resolves.toEqual([
        expect.objectContaining({ status: "pending" }),
      ]);

      const [document] = [...store.renderedDocuments.values()];
      await completePersistedRenderedDocumentSigning(document.id as string);

      await expect(formSummaries()).resolves.toEqual([
        expect.objectContaining({
          status: "completed",
          assignmentStatus: "signed",
        }),
      ]);
      expect(store.templateInstances.get(submission._id)?.status).toBe(
        "SIGNED",
      );
      await expect(listConsentDocuments()).resolves.toEqual([
        expect.objectContaining({ signingStatus: "SIGNED" }),
      ]);
    });

    const startClientSigning = (instanceId: string) =>
      FormSigningService.startSigning({
        isParent: true,
        submissionId: instanceId,
        initiatedBy: PARENT,
      });

    // Clinic pre-fill: the practice fills the consent in, the client signs it.
    it("is given on a consent the practice filled in first", async () => {
      seedTemplate("tpl-consent", "CONSENT", { name: "Anaesthesia consent" });
      const staffSave = await submitFromPms("tpl-consent");
      // The practice's save does not answer the request sent to the client.
      expect(store.formAssignments[0].status).toBe("SENT");
      await expect(formSummaries()).resolves.toEqual([
        expect.objectContaining({ status: "pending" }),
      ]);

      armDocumenso();
      await expect(startClientSigning(staffSave._id)).resolves.toMatchObject({
        signingUrl: "https://sign.example/sign/recipient-token",
      });
      const [document] = [...store.renderedDocuments.values()];
      await completePersistedRenderedDocumentSigning(document.id as string);

      await expect(formSummaries()).resolves.toEqual([
        expect.objectContaining({
          status: "completed",
          assignmentStatus: "signed",
        }),
      ]);
      expect(store.templateInstances.get(staffSave._id)?.status).toBe("SIGNED");
    });

    // The practice corrects a pre-filled consent by saving it again. The
    // client signs the corrected version; a signature on the first no longer
    // answers the request.
    it("is given on the practice's corrected version, not the first", async () => {
      seedTemplate("tpl-consent", "CONSENT", { name: "Anaesthesia consent" });
      const first = await submitFromPms("tpl-consent");
      armDocumenso();
      // Sent to the client before the correction.
      await startClientSigning(first._id);
      const corrected = await submitFromPms("tpl-consent");
      expect(corrected._id).not.toBe(first._id);

      // The client finishes signing the first version after all.
      const firstDocument = [...store.renderedDocuments.values()].find(
        (doc) => doc.templateInstanceId === first._id,
      );
      await completePersistedRenderedDocumentSigning(
        firstDocument?.id as string,
      );
      expect(store.formAssignments[0].status).toBe("SENT");
      await expect(formSummaries()).resolves.toEqual([
        expect.objectContaining({ status: "pending" }),
      ]);
      // Nor can it be sent for signing again.
      await expect(startClientSigning(first._id)).rejects.toThrow(
        "A newer version of this form is waiting for your signature",
      );

      await startClientSigning(corrected._id);
      const correctedDocument = [...store.renderedDocuments.values()].find(
        (doc) => doc.templateInstanceId === corrected._id,
      );
      await completePersistedRenderedDocumentSigning(
        correctedDocument?.id as string,
      );

      await expect(formSummaries()).resolves.toEqual([
        expect.objectContaining({
          status: "completed",
          assignmentStatus: "signed",
        }),
      ]);
    });

    it("stays the client's after a staff save that follows it", async () => {
      seedTemplate("tpl-consent", "CONSENT", { name: "Anaesthesia consent" });
      const parentSubmit = await submitFromMobile("tpl-consent");
      const staffSave = await submitFromPms("tpl-consent");

      expect(staffSave._id).not.toBe(parentSubmit._id);
      expect(store.templateInstances.get(parentSubmit._id)).toMatchObject({
        status: "COMPLETED",
        authorId: PARENT,
      });
      expect(store.formAssignments[0].status).toBe("SUBMITTED");

      armDocumenso();
      await startClientSigning(parentSubmit._id);
      const parentDocument = [...store.renderedDocuments.values()].find(
        (doc) => doc.templateInstanceId === parentSubmit._id,
      );
      await completePersistedRenderedDocumentSigning(
        parentDocument?.id as string,
      );

      await expect(formSummaries()).resolves.toEqual([
        expect.objectContaining({ status: "completed" }),
      ]);
    });

    // A double tap on View & Sign: one Documenso document, one link.
    it("sends one document when it is started twice at once", async () => {
      seedTemplate("tpl-consent", "CONSENT", { name: "Anaesthesia consent" });
      const submission = await submitFromMobile("tpl-consent");
      armDocumenso();

      const results = await Promise.allSettled([
        startClientSigning(submission._id),
        startClientSigning(submission._id),
      ]);

      expect(documenso.createDocument).toHaveBeenCalledTimes(1);
      expect(results.map(({ status }) => status).sort()).toEqual([
        "fulfilled",
        "rejected",
      ]);
      expect(
        results.find(
          (result): result is PromiseRejectedResult =>
            result.status === "rejected",
        )?.reason,
      ).toMatchObject({ statusCode: 409 });
      // Tapping again once it is sent reopens the same signing.
      await expect(startClientSigning(submission._id)).resolves.toEqual({
        documentId: "4242",
        signingUrl: "https://sign.example/sign/recipient-token",
      });
      expect(documenso.createDocument).toHaveBeenCalledTimes(1);
    });

    it("cannot be given by practice staff, so the visit stays blocked", async () => {
      seedTemplate("tpl-consent", "CONSENT", { name: "Anaesthesia consent" });
      await submitFromMobile("tpl-consent");
      const [document] = await listConsentDocuments();

      await expect(
        signAndComplete(document.id as string, VET_SIGNER),
      ).rejects.toMatchObject({ statusCode: 409 });

      await expect(formSummaries()).resolves.toEqual([
        expect.objectContaining({ status: "pending" }),
      ]);
      await expect(listConsentDocuments()).resolves.toEqual([
        expect.objectContaining({ signingStatus: "NOT_STARTED" }),
      ]);
    });
  });

  // POST /v1/document/mobile/appointments/:appointmentId, as the pet parent.
  describe("the pet parent's appointment documents", () => {
    const listForParent = () =>
      DocumentService.listForAppointmentParent({
        appointmentId: APPOINTMENT,
        parentId: PARENT,
      });

    it("include the consent the practice sent them, whatever its visibility", async () => {
      // The form builder defaults a template's usage to Internal.
      seedTemplate("tpl-consent", "CONSENT", {
        name: "Anaesthesia consent",
        visibility: "Internal",
      });
      await submitFromMobile("tpl-consent");

      await expect(listForParent()).resolves.toEqual([
        expect.objectContaining({
          category: "CONSENT",
          title: "Anaesthesia consent",
          signingStatus: "NOT_STARTED",
        }),
      ]);
    });

    it("leave out a form the practice marked Internal and never sent them", async () => {
      seedTemplate("tpl-internal", "FORM", {
        category: "Custom",
        visibility: "Internal",
        assigned: false,
      });
      seedTemplate("tpl-external", "FORM", {
        category: "Custom",
        visibility: "Internal & External",
        assigned: false,
      });
      await submitFromPms("tpl-internal");
      await submitFromPms("tpl-external");

      const documents = await listForParent();

      expect(documents.map(({ templateId }) => templateId)).toEqual([
        "tpl-external",
      ]);
    });

    it.each([
      "SOAP_NOTE",
      "PRESCRIPTION",
      "DISCHARGE_SUMMARY",
      "VITAL_RECORD",
    ] as const)("leave out a %s document until it is signed", async (kind) => {
      seedTemplate("tpl-clinical", kind, {
        visibility: "External",
        assigned: false,
      });
      await submitFromPms("tpl-clinical");

      await expect(listForParent()).resolves.toEqual([]);

      const [document] = [...store.renderedDocuments.values()];
      await signAndComplete(document.id as string);

      await expect(listForParent()).resolves.toEqual([
        expect.objectContaining({ id: document.id, signingStatus: "SIGNED" }),
      ]);
    });

    it("leave out a signed clinical document from a template marked Internal", async () => {
      seedTemplate("tpl-clinical", "SOAP_NOTE", {
        visibility: "Internal",
        assigned: false,
      });
      await submitFromPms("tpl-clinical");
      const [document] = [...store.renderedDocuments.values()];
      await signAndComplete(document.id as string);

      await expect(listForParent()).resolves.toEqual([]);
    });
  });
});
