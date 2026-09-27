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
      if (
        condition &&
        typeof condition === "object" &&
        "gte" in (condition as Record<string, unknown>)
      ) {
        const bound = (condition as { gte: Date }).gte;
        return value instanceof Date && value.getTime() >= bound.getTime();
      }
      if (
        condition &&
        typeof condition === "object" &&
        "lte" in (condition as Record<string, unknown>)
      ) {
        const bound = (condition as { lte: Date }).lte;
        return value instanceof Date && value.getTime() <= bound.getTime();
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
  // A select that names the instance's template relation reads it too.
  const withTemplate = (instance: Row, select?: Record<string, unknown>) => {
    if (!select) return instance;
    const templateSelect = (
      select as { template?: { select: Record<string, boolean> } }
    ).template;
    const template = store.templates.get(instance.templateId as string);
    return {
      ...pick(instance, select as Record<string, boolean>),
      ...(templateSelect
        ? { template: template ? pick(template, templateSelect.select) : null }
        : {}),
    };
  };
  const findVersion = (templateId: unknown, version: unknown) =>
    store.templateVersions.find(
      (row) => row.templateId === templateId && row.version === version,
    ) ?? null;

  let assignmentSequence = 0;
  // A withdrawal is stamped on the store's own clock, as one database clock
  // stamps every row, so it orders against the rows written around it.
  const stampWithdrawal = (data: Row): Row => ({
    ...data,
    ...(data.cancelledAt instanceof Date ? { cancelledAt: tick() } : {}),
    ...(data.expiredAt instanceof Date ? { expiredAt: tick() } : {}),
  });
  const client = {
    template: {
      // The template a request is sent for (FormAssignmentService).
      findFirst: async ({
        where,
        select,
      }: {
        where: Row;
        select?: Record<string, boolean>;
      }) => {
        const template = [...store.templates.values()].find((row) =>
          matches(row, where),
        );
        return template ? pick(template, select) : null;
      },
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
      // The kind and rules a request's signing follows.
      findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
        [...store.templates.values()]
          .filter((template) => where.id.in.includes(template.id as string))
          .map((template) =>
            pick(template, { id: true, kind: true, rules: true }),
          ),
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
        if (select) return withTemplate(instance, select);
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
          .map((instance) => withTemplate(instance, select)),
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
                  authorId: true,
                  status: true,
                  generatedPdf: true,
                }),
                template: template
                  ? { kind: template.kind, rules: template.rules }
                  : null,
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
        store.parentLinks.find((link) => matches(link, where)) ?? null,
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
      count: async ({ where }: { where: Row }) =>
        store.formAssignments.filter((assignment) => matches(assignment, where))
          .length,
      create: async ({ data }: { data: Row }) => {
        const assignment = {
          id: `assignment-${++assignmentSequence}`,
          createdAt: tick(),
          ...defined(data),
        };
        store.formAssignments.push(assignment);
        return { ...assignment };
      },
      // Conditional on the whole WHERE, as Prisma's is on a unique filter.
      update: async ({ where, data }: { where: Row; data: Row }) => {
        const index = store.formAssignments.findIndex((assignment) =>
          matches(assignment, where),
        );
        if (index === -1) throw notFound();
        store.formAssignments[index] = {
          ...store.formAssignments[index],
          ...defined(stampWithdrawal(data)),
        };
        return store.formAssignments[index];
      },
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        let count = 0;
        store.formAssignments.forEach((assignment, index) => {
          if (!matches(assignment, where)) return;
          store.formAssignments[index] = {
            ...assignment,
            ...defined(stampWithdrawal(data)),
          };
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
      // The client accounts here are parent-1 and parent-2.
      count: async ({ where }: { where: { id: string | { in: string[] } } }) =>
        (typeof where.id === "string" ? [where.id] : where.id.in).filter(
          (id) => id === "parent-1" || id === "parent-2",
        ).length,
      findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in
          .filter((id) => id === "parent-1" || id === "parent-2")
          .map((id) => ({ id })),
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
    const heldKeys = new Set<string>();
    const tx = {
      ...client,
      $executeRaw: async (_sql: TemplateStringsArray, key: string) => {
        // Taken again by the transaction that holds it: Postgres grants it.
        if (heldKeys.has(key)) return 1;
        heldKeys.add(key);
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
        // Every transaction here writes only once it holds its lock, so what
        // it would roll back is what stood when it got it, not what other
        // transactions committed while it waited.
        if (releases.length === 1) snapshot = takeSnapshot();
        return 1;
      },
    };
    // A transaction that throws writes nothing: its rows go back as they were.
    const takeSnapshot = () =>
      structuredClone({
        templateInstances: [...store.templateInstances],
        renderedDocuments: [...store.renderedDocuments],
        documentSignatures: store.documentSignatures,
        formAssignments: store.formAssignments,
      });
    let snapshot = takeSnapshot();
    try {
      return await callback(tx);
    } catch (error) {
      store.templateInstances = new Map(snapshot.templateInstances);
      store.renderedDocuments = new Map(snapshot.renderedDocuments);
      store.documentSignatures.splice(
        0,
        store.documentSignatures.length,
        ...snapshot.documentSignatures,
      );
      store.formAssignments.splice(
        0,
        store.formAssignments.length,
        ...snapshot.formAssignments,
      );
      throw error;
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
    sendEnvelope: jest.fn(),
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
    // Who the builder says signs it (rules.requiredSigner).
    requiredSigner?: string;
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
      options.category || options.visibility || options.requiredSigner
        ? {
            category: options.category,
            visibility: options.visibility,
            requiredSigner: options.requiredSigner,
          }
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
    mobileVisible: true,
    status: "SENT",
    // Sent before anything is submitted for it.
    createdAt: new Date("2026-09-24T07:00:00.000Z"),
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
  documenso.sendEnvelope.mockResolvedValue("sent");
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
    status: "ACTIVE",
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

    // A parent fills in only forms and consents; the practice any kind.
    it.each(
      (
        [
          "FORM",
          "SOAP_NOTE",
          "PRESCRIPTION",
          "DISCHARGE_SUMMARY",
          "VITAL_RECORD",
        ] as const
      ).filter((kind) => submit === submitFromPms || kind === "FORM"),
    )("renders a %s template as a document of its own kind", async (kind) => {
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
    });
  });

  it.each([
    "SOAP_NOTE",
    "PRESCRIPTION",
    "DISCHARGE_SUMMARY",
    "VITAL_RECORD",
  ] as const)(
    "answers a parent's %s submission as a missing form, rendering nothing",
    async (kind) => {
      seedTemplate("tpl-doc", kind, { category: "Custom" });

      await expect(submitFromMobile("tpl-doc")).rejects.toMatchObject({
        statusCode: 404,
        message: "Form not found",
      });
      expect(store.renderedDocuments.size).toBe(0);
    },
  );

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

  // What lets a parent answer is checked again once their submission holds
  // the request's lock, so a practice save or a withdrawal that lands between
  // the first check and the lock is seen.
  describe("a parent's submission racing the practice", () => {
    const beforeTheLock = (practiceStep: () => Promise<unknown>) => {
      const transaction = prisma.$transaction.bind(prisma);
      return jest.spyOn(prisma, "$transaction").mockImplementationOnce((async (
        ...args: unknown[]
      ) => {
        await practiceStep();
        return (transaction as (...a: unknown[]) => unknown)(...args);
      }) as never);
    };

    it("is refused over a form the practice filled in meanwhile", async () => {
      seedTemplate("tpl-consent", "CONSENT", { name: "Anaesthesia consent" });
      const race = beforeTheLock(() => submitFromPms("tpl-consent"));

      await expect(submitFromMobile("tpl-consent")).rejects.toMatchObject({
        statusCode: 409,
        message: "This form was already completed at the practice",
      });
      race.mockRestore();

      const instances = [...store.templateInstances.values()];
      expect(instances.map(({ authorId }) => authorId)).toEqual(["vet-1"]);
    });

    // Two parents submit at once, and the first is recorded but its request
    // not yet marked submitted when the second takes the lock: the second is
    // refused, so the request has one parent's answers.
    it("takes one parent's answers when two submit at once", async () => {
      seedTemplate("tpl-consent", "CONSENT", { name: "Anaesthesia consent" });
      store.parentLinks.push({
        parentId: "parent-2",
        patientId: PATIENT,
        role: "CO_PARENT",
        status: "ACTIVE",
        permissions: { appointments: true },
      });
      const markLater = jest
        .spyOn(FormAssignmentService, "markSubmittedFromSubmission")
        .mockResolvedValueOnce(null);
      const race = beforeTheLock(() => submitFromMobile("tpl-consent"));

      await expect(
        FormService.submitFHIR(
          toFormSubmissionResponseDTO({
            _id: "",
            formId: "tpl-consent",
            formVersion: 2,
            appointmentId: APPOINTMENT,
            companionId: PATIENT,
            parentId: "parent-2",
            answers: { agree: "yes" },
            submittedAt: new Date("2026-09-24T08:00:00.000Z"),
          } as FormSubmission),
          undefined,
          "parent-2",
          { parentId: "parent-2" },
        ),
      ).rejects.toMatchObject({
        statusCode: 409,
        message: "Form already submitted",
      });
      race.mockRestore();
      markLater.mockRestore();

      const answers = [...store.templateInstances.values()];
      expect(answers.map(({ authorId }) => authorId)).toEqual([PARENT]);
    });

    it("is refused once the practice withdrew the request meanwhile", async () => {
      seedTemplate("tpl-consent", "CONSENT", { name: "Anaesthesia consent" });
      const race = beforeTheLock(() =>
        FormAssignmentService.cancel(
          store.formAssignments[0].id as string,
          ORG,
          "vet-1",
        ),
      );

      await expect(submitFromMobile("tpl-consent")).rejects.toMatchObject({
        statusCode: 404,
        message: "Form not found",
      });
      race.mockRestore();

      expect(store.templateInstances.size).toBe(0);
      expect(store.formAssignments[0].status).toBe("CANCELLED");
    });
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

    // The practice corrects the consent after the client signed it: the
    // corrected version waits for their signature again.
    it("is asked for again on a correction saved after it was given", async () => {
      seedTemplate("tpl-consent", "CONSENT", { name: "Anaesthesia consent" });
      const first = await submitFromPms("tpl-consent");
      armDocumenso();
      await startClientSigning(first._id);
      const [firstDocument] = [...store.renderedDocuments.values()];
      await completePersistedRenderedDocumentSigning(
        firstDocument.id as string,
      );
      expect(store.formAssignments[0].status).toBe("SIGNED");

      const corrected = await submitFromPms("tpl-consent");

      expect(store.formAssignments[0]).toMatchObject({
        status: "SENT",
        signedAt: null,
      });
      await expect(formSummaries()).resolves.toEqual([
        expect.objectContaining({
          status: "pending",
          assignmentStatus: "sent",
        }),
      ]);

      await startClientSigning(corrected._id);
      const correctedDocument = [...store.renderedDocuments.values()].find(
        (doc) => doc.templateInstanceId === corrected._id,
      );
      await completePersistedRenderedDocumentSigning(
        correctedDocument?.id as string,
      );
      await expect(formSummaries()).resolves.toEqual([
        expect.objectContaining({ status: "completed" }),
      ]);
    });

    it("stays given on the client's own consent after a staff save", async () => {
      seedTemplate("tpl-consent", "CONSENT", { name: "Anaesthesia consent" });
      const own = await submitFromMobile("tpl-consent");
      armDocumenso();
      await startClientSigning(own._id);
      const [ownDocument] = [...store.renderedDocuments.values()];
      await completePersistedRenderedDocumentSigning(ownDocument.id as string);

      await submitFromPms("tpl-consent");

      expect(store.formAssignments[0].status).toBe("SIGNED");
    });

    // A consent the practice signs is signed by staff, like any record.
    it("is not asked for on a consent the practice signs", async () => {
      seedTemplate("tpl-vet-consent", "CONSENT", {
        name: "Procedure consent",
        requiredSigner: "VET",
      });
      await submitFromPms("tpl-vet-consent");
      const [document] = await listConsentDocuments();

      await signAndComplete(document.id as string, VET_SIGNER);

      await expect(listConsentDocuments()).resolves.toEqual([
        expect.objectContaining({ signingStatus: "SIGNED" }),
      ]);
    });

    // A correction saved through the template routes, not the form route,
    // reopens the request the same way.
    it("is asked for again on a correction saved through the template routes", async () => {
      seedTemplate("tpl-consent", "CONSENT", { name: "Anaesthesia consent" });
      const first = await submitFromPms("tpl-consent");
      armDocumenso();
      await startClientSigning(first._id);
      const [firstDocument] = [...store.renderedDocuments.values()];
      await completePersistedRenderedDocumentSigning(
        firstDocument.id as string,
      );
      expect(store.formAssignments[0].status).toBe("SIGNED");

      const corrected = await TemplateService.createInstance({
        templateId: "tpl-consent",
        organisationId: ORG,
        appointmentId: APPOINTMENT,
        authorId: "vet-1",
        data: { agree: "yes" },
      });
      await TemplateService.submitInstance(corrected.id, ORG, "vet-1");

      expect(store.formAssignments[0]).toMatchObject({
        status: "SENT",
        signedAt: null,
      });
    });

    // A co-parent whose access was removed while the signature was out no
    // longer answers for the companion: nothing reads signed.
    it("is not taken from a client whose access was removed meanwhile", async () => {
      seedTemplate("tpl-consent", "CONSENT", { name: "Anaesthesia consent" });
      const submission = await submitFromPms("tpl-consent");
      armDocumenso();
      await startClientSigning(submission._id);
      store.parentLinks[0].status = "REVOKED";

      const [document] = [...store.renderedDocuments.values()];
      await completePersistedRenderedDocumentSigning(document.id as string);

      expect(store.formAssignments[0].status).toBe("SENT");
      expect(store.templateInstances.get(submission._id)?.status).toBe(
        "COMPLETED",
      );
      await expect(listConsentDocuments()).resolves.toEqual([
        expect.objectContaining({ signingStatus: "NOT_STARTED" }),
      ]);
    });

    // Submitted before submitting rendered a document: the document is
    // rendered when the client comes to sign it.
    it("is given on a consent submitted before it had a document", async () => {
      seedTemplate("tpl-consent", "CONSENT", { name: "Anaesthesia consent" });
      seedTemplateInstance("inst-old", "tpl-consent", PARENT);
      store.templateInstances.get("inst-old")!.status = "COMPLETED";
      store.formAssignments[0].status = "SUBMITTED";
      armDocumenso();

      await expect(startClientSigning("inst-old")).resolves.toMatchObject({
        signingUrl: "https://sign.example/sign/recipient-token",
      });
      const [document] = [...store.renderedDocuments.values()];
      expect(document).toMatchObject({
        kind: "CONSENT",
        templateInstanceId: "inst-old",
      });
      await completePersistedRenderedDocumentSigning(document.id as string);

      await expect(formSummaries()).resolves.toEqual([
        expect.objectContaining({ status: "completed" }),
      ]);
    });

    // Who signs was pinned when it was submitted: an edit to the template
    // afterwards changes nothing for it.
    it("is still the client's after the template is changed to the vet", async () => {
      seedTemplate("tpl-consent", "CONSENT", { name: "Anaesthesia consent" });
      const submission = await submitFromMobile("tpl-consent");
      store.templates.get("tpl-consent")!.rules = { requiredSigner: "VET" };
      const [document] = await listConsentDocuments();

      await expect(
        signAndComplete(document.id as string, VET_SIGNER),
      ).rejects.toMatchObject({ statusCode: 409 });

      armDocumenso();
      await startClientSigning(submission._id);
      await completePersistedRenderedDocumentSigning(document.id as string);
      await expect(formSummaries()).resolves.toEqual([
        expect.objectContaining({ status: "completed" }),
      ]);
    });

    // The practice withdrew the request while the client's signature was out:
    // the signature that arrives afterwards is not recorded.
    it("is not taken once the practice withdraws the request", async () => {
      seedTemplate("tpl-consent", "CONSENT", { name: "Anaesthesia consent" });
      const submission = await submitFromMobile("tpl-consent");
      armDocumenso();
      await startClientSigning(submission._id);

      await FormAssignmentService.cancel(
        store.formAssignments[0].id as string,
        ORG,
        "vet-1",
      );
      const [document] = [...store.renderedDocuments.values()];
      await completePersistedRenderedDocumentSigning(document.id as string);

      expect(store.formAssignments[0].status).toBe("CANCELLED");
      expect(store.templateInstances.get(submission._id)?.status).toBe(
        "COMPLETED",
      );
      await expect(listConsentDocuments()).resolves.toEqual([
        expect.objectContaining({ signingStatus: "NOT_STARTED" }),
      ]);
    });

    // A consent set to no signature is not waited on.
    it("is not asked for on a consent set to no signature", async () => {
      seedTemplate("tpl-consent", "CONSENT", {
        name: "Visit terms",
        requiredSigner: "NONE",
      });

      await submitFromPms("tpl-consent");

      await expect(formSummaries()).resolves.toEqual([
        expect.objectContaining({
          status: "completed",
          signingRequired: false,
        }),
      ]);
      // Listed as needing no signature, not as waiting for one.
      await expect(listConsentDocuments()).resolves.toEqual([
        expect.objectContaining({
          signingStatus: "NOT_STARTED",
          signer: "NONE",
        }),
      ]);
    });

    it("is not taken for a form the practice signs", async () => {
      seedTemplate("tpl-vet", "FORM", {
        category: "Custom",
        requiredSigner: "VET",
      });
      const staffSave = await submitFromPms("tpl-vet");

      // The practice's answers, for the vet: answered as missing.
      await expect(startClientSigning(staffSave._id)).rejects.toThrow(
        "Form submission not found",
      );
      expect(documenso.createDocument).not.toHaveBeenCalled();
    });

    // A co-parent answers the appointment's request as its primary parent
    // would.
    it("is not needed once a co-parent submits a form the client does not sign", async () => {
      seedTemplate("tpl-intake", "FORM", { category: "Custom" });
      store.parentLinks.push({
        parentId: "parent-2",
        patientId: PATIENT,
        role: "CO_PARENT",
        status: "ACTIVE",
        permissions: { appointments: true },
      });

      await FormService.submitFHIR(
        toFormSubmissionResponseDTO({
          _id: "",
          formId: "tpl-intake",
          formVersion: 2,
          appointmentId: APPOINTMENT,
          companionId: PATIENT,
          parentId: "parent-2",
          answers: { agree: "yes" },
          submittedAt: new Date("2026-09-24T08:00:00.000Z"),
        } as FormSubmission),
        undefined,
        "parent-2",
        { parentId: "parent-2" },
      );

      expect(store.formAssignments[0].status).toBe("SUBMITTED");
      await expect(formSummaries()).resolves.toEqual([
        expect.objectContaining({ status: "completed" }),
      ]);
    });

    // Filled in by the practice, a form the client does not sign is done.
    it("is not needed for a form the client does not sign", async () => {
      seedTemplate("tpl-intake", "FORM", { category: "Custom" });

      await submitFromPms("tpl-intake");

      expect(store.formAssignments[0].status).toBe("SUBMITTED");
      await expect(formSummaries()).resolves.toEqual([
        expect.objectContaining({
          status: "completed",
          signingRequired: false,
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

    // Sent while the vet signed it, then changed to the client before it was
    // submitted: the request follows the signer the submission pins, so the
    // client can sign the consent that waits for them.
    it("is the client's on a consent changed to them after it was sent", async () => {
      seedTemplate("tpl-consent", "CONSENT", {
        name: "Anaesthesia consent",
        requiredSigner: "VET",
      });
      store.formAssignments[0].signingRequired = false;
      store.templates.get("tpl-consent")!.rules = { requiredSigner: "CLIENT" };
      const submission = await submitFromMobile("tpl-consent");

      armDocumenso();
      await startClientSigning(submission._id);
      const [document] = [...store.renderedDocuments.values()];
      await completePersistedRenderedDocumentSigning(document.id as string);

      expect(store.formAssignments[0]).toMatchObject({
        signingRequired: true,
        status: "SIGNED",
      });
      await expect(listConsentDocuments()).resolves.toEqual([
        expect.objectContaining({ signingStatus: "SIGNED" }),
      ]);
    });

    // Withdrawn, then sent again: the client's submission answers the one
    // sent again, and sending it once more makes no second request.
    it("answers the request sent again after one was withdrawn", async () => {
      seedTemplate("tpl-consent", "CONSENT", { name: "Anaesthesia consent" });
      await FormAssignmentService.cancel(
        store.formAssignments[0].id as string,
        ORG,
        "vet-1",
      );
      const send = () =>
        FormAssignmentService.createForAppointment({
          organisationId: ORG,
          appointmentId: APPOINTMENT,
          templateId: "tpl-consent",
          createdBy: "vet-1",
        });
      const again = await send();
      await expect(send()).resolves.toMatchObject({
        assignmentId: again.assignmentId,
      });

      await submitFromMobile("tpl-consent");

      expect(store.formAssignments.map(({ status }) => status)).toEqual([
        "CANCELLED",
        "SUBMITTED",
      ]);
      await expect(formSummaries()).resolves.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            assignmentStatus: "submitted",
            signingRequired: true,
          }),
        ]),
      );
    });

    // The practice withdraws the request while the client's signature is
    // being recorded: one of the two happens whole, never half of each.
    it("is not withdrawn part-way through being recorded", async () => {
      seedTemplate("tpl-consent", "CONSENT", { name: "Anaesthesia consent" });
      const submission = await submitFromMobile("tpl-consent");
      armDocumenso();
      await startClientSigning(submission._id);
      const [document] = [...store.renderedDocuments.values()];

      // The completion stops inside its transaction after finding the request
      // open, just before it marks the request signed.
      const assignments = prisma.formAssignment as unknown as {
        updateMany: (args: unknown) => Promise<unknown>;
      };
      const markSigned = assignments.updateMany;
      let resume: () => void = () => undefined;
      let reached: () => void = () => undefined;
      const inside = new Promise<void>((resolve) => {
        reached = resolve;
      });
      const hold = jest
        .spyOn(assignments, "updateMany")
        .mockImplementationOnce(async (args) => {
          reached();
          await new Promise<void>((resolve) => {
            resume = resolve;
          });
          return markSigned(args);
        });

      const completing = completePersistedRenderedDocumentSigning(
        document.id as string,
      );
      await inside;
      const cancelled = FormAssignmentService.cancel(
        store.formAssignments[0].id as string,
        ORG,
        "vet-1",
      ).then(
        () => null,
        (error: unknown) => error,
      );
      await new Promise((resolve) => setImmediate(resolve));
      resume();
      await completing;
      hold.mockRestore();

      await expect(cancelled).resolves.toMatchObject({ statusCode: 409 });
      expect(store.formAssignments[0].status).toBe("SIGNED");
      await expect(listConsentDocuments()).resolves.toEqual([
        expect.objectContaining({ signingStatus: "SIGNED" }),
      ]);
    });

    // Documenso sent it: nothing afterwards puts the signing back, whether a
    // signature arrives first or recording the send fails.
    describe("once Documenso has sent it", () => {
      it("keeps a signature given before the send was recorded", async () => {
        seedTemplate("tpl-consent", "CONSENT", {
          name: "Anaesthesia consent",
        });
        const submission = await submitFromMobile("tpl-consent");
        armDocumenso();
        documenso.sendEnvelope.mockImplementationOnce(async () => {
          const [sending] = [...store.renderedDocuments.values()];
          await completePersistedRenderedDocumentSigning(sending.id as string);
          return "sent";
        });

        await expect(startClientSigning(submission._id)).rejects.toMatchObject({
          statusCode: 409,
        });

        const [document] = [...store.renderedDocuments.values()];
        expect(document).toMatchObject({
          status: "SIGNED",
          signing: expect.objectContaining({
            status: "SIGNED",
            documentId: "4242",
          }),
        });
        await expect(formSummaries()).resolves.toEqual([
          expect.objectContaining({ status: "completed" }),
        ]);
      });

      it("keeps the signing when recording the send fails", async () => {
        seedTemplate("tpl-consent", "CONSENT", {
          name: "Anaesthesia consent",
        });
        const submission = await submitFromMobile("tpl-consent");
        armDocumenso();
        const write = jest
          .spyOn(
            prisma.renderedDocument as unknown as {
              update: (args: unknown) => Promise<unknown>;
            },
            "update",
          )
          .mockRejectedValueOnce(new Error("connection lost"));

        await expect(startClientSigning(submission._id)).rejects.toThrow(
          "connection lost",
        );
        write.mockRestore();

        const [document] = [...store.renderedDocuments.values()];
        expect(document.signing).toMatchObject({
          documentId: "4242",
          awaitingSend: true,
        });
        // The client's signature on what they were sent still completes.
        await completePersistedRenderedDocumentSigning(document.id as string);
        await expect(listConsentDocuments()).resolves.toEqual([
          expect.objectContaining({ signingStatus: "SIGNED" }),
        ]);
      });
    });

    // The client submits while the practice withdraws the request: the
    // withdrawal stands, and the request is not reopened by the submission.
    it("stays withdrawn when the client submits as it is withdrawn", async () => {
      seedTemplate("tpl-consent", "CONSENT", { name: "Anaesthesia consent" });
      const assignments = prisma.formAssignment as unknown as {
        findMany: (args: { include?: unknown }) => Promise<Row[]>;
      };
      const read = assignments.findMany;
      const withdrawAfterRead = jest
        .spyOn(assignments, "findMany")
        .mockImplementation(async (args) => {
          const rows = await read(args);
          // The lookup that finds the request the submission answers.
          if (args.include) {
            await FormAssignmentService.cancel(
              store.formAssignments[0].id as string,
              ORG,
              "vet-1",
            );
          }
          return rows;
        });

      await submitFromMobile("tpl-consent");
      withdrawAfterRead.mockRestore();

      expect(store.formAssignments[0].status).toBe("CANCELLED");
    });

    // The client's signature completes while the practice resends the
    // request: the signature stands, and the request is not reopened.
    it("stays signed when it is resent as the signature completes", async () => {
      seedTemplate("tpl-consent", "CONSENT", { name: "Anaesthesia consent" });
      const submission = await submitFromMobile("tpl-consent");
      armDocumenso();
      await startClientSigning(submission._id);
      const [document] = [...store.renderedDocuments.values()];
      const assignments = prisma.formAssignment as unknown as {
        findFirst: (args: unknown) => Promise<Row | null>;
      };
      const read = assignments.findFirst;
      const signAfterRead = jest
        .spyOn(assignments, "findFirst")
        .mockImplementationOnce(async (args) => {
          const row = await read(args);
          await completePersistedRenderedDocumentSigning(document.id as string);
          return row;
        });

      await expect(
        FormAssignmentService.resend(
          store.formAssignments[0].id as string,
          ORG,
          "vet-1",
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      signAfterRead.mockRestore();

      expect(store.formAssignments[0].status).toBe("SIGNED");
      await expect(formSummaries()).resolves.toEqual([
        expect.objectContaining({ status: "completed" }),
      ]);
    });

    // Withdrawn after the client answered, then sent again: the answers they
    // gave the withdrawn request do not answer the new one, so their next
    // submission is recorded as a new one.
    it("is answered afresh once the request is sent again", async () => {
      seedTemplate("tpl-consent", "CONSENT", { name: "Anaesthesia consent" });
      const first = await submitFromMobile("tpl-consent");
      await FormAssignmentService.cancel(
        store.formAssignments[0].id as string,
        ORG,
        "vet-1",
      );
      await FormAssignmentService.createForAppointment({
        organisationId: ORG,
        appointmentId: APPOINTMENT,
        templateId: "tpl-consent",
        createdBy: "vet-1",
      });

      const second = await submitFromMobile("tpl-consent");

      expect(second._id).not.toBe(first._id);
      expect(store.templateInstances.get(second._id)?.status).toBe("COMPLETED");
      expect(store.formAssignments.map(({ status }) => status)).toEqual([
        "CANCELLED",
        "SUBMITTED",
      ]);
    });

    // Answers given to a request the practice withdrew answer no request sent
    // after it: they cannot be signed for it, a signature on them is not
    // recorded against it, and they do not mark it submitted.
    describe("on answers given to a request since withdrawn", () => {
      const withdrawAndSendAgain = async () => {
        await FormAssignmentService.cancel(
          store.formAssignments[0].id as string,
          ORG,
          "vet-1",
        );
        await FormAssignmentService.createForAppointment({
          organisationId: ORG,
          appointmentId: APPOINTMENT,
          templateId: "tpl-consent",
          createdBy: "vet-1",
        });
      };

      it("cannot be started for the request sent again", async () => {
        seedTemplate("tpl-consent", "CONSENT", { name: "Anaesthesia consent" });
        const withdrawnAnswers = await submitFromMobile("tpl-consent");
        await withdrawAndSendAgain();
        armDocumenso();

        await expect(startClientSigning(withdrawnAnswers._id)).rejects.toThrow(
          "Form submission not found",
        );
        expect(documenso.createDocument).not.toHaveBeenCalled();
      });

      it("is not recorded against the request sent again", async () => {
        seedTemplate("tpl-consent", "CONSENT", { name: "Anaesthesia consent" });
        const withdrawnAnswers = await submitFromMobile("tpl-consent");
        armDocumenso();
        await startClientSigning(withdrawnAnswers._id);
        await withdrawAndSendAgain();
        const [document] = [...store.renderedDocuments.values()];

        await completePersistedRenderedDocumentSigning(document.id as string);

        expect(store.formAssignments.map(({ status }) => status)).toEqual([
          "CANCELLED",
          "SENT",
        ]);
        expect(store.templateInstances.get(withdrawnAnswers._id)?.status).toBe(
          "COMPLETED",
        );
      });

      // The practice withdraws and sends it again just after the client's
      // answers are recorded, before their request is marked submitted.
      it("do not mark the request sent again submitted", async () => {
        seedTemplate("tpl-consent", "CONSENT", { name: "Anaesthesia consent" });
        const assignments = prisma.formAssignment as unknown as {
          findMany: (args: { include?: unknown }) => Promise<Row[]>;
        };
        const read = assignments.findMany;
        const resendBeforeMarking = jest
          .spyOn(assignments, "findMany")
          .mockImplementation(async (args) => {
            // The lookup that finds the request the submission answers.
            if (args.include) {
              resendBeforeMarking.mockRestore();
              await withdrawAndSendAgain();
            }
            return read(args);
          });

        await submitFromMobile("tpl-consent");

        expect(store.formAssignments.map(({ status }) => status)).toEqual([
          "CANCELLED",
          "SENT",
        ]);
      });
    });

    // A signature marks signed only the requests the signed answers are for,
    // not one sent after them.
    it("marks signed only the request the signed answers were given to", async () => {
      seedTemplate("tpl-consent", "CONSENT", { name: "Anaesthesia consent" });
      const submission = await submitFromMobile("tpl-consent");
      armDocumenso();
      await startClientSigning(submission._id);
      store.formAssignments.push({
        ...store.formAssignments[0],
        id: "assignment-later",
        status: "SENT",
        createdAt: new Date("2026-09-30T09:00:00.000Z"),
      });
      const [document] = [...store.renderedDocuments.values()];

      await completePersistedRenderedDocumentSigning(document.id as string);

      expect(
        store.formAssignments.map(({ id, status }) => [id, status]),
      ).toEqual([
        ["assignment-tpl-consent", "SIGNED"],
        ["assignment-later", "SENT"],
      ]);
    });

    // Package expansion left a draft before the request was sent; the
    // practice fills it in, and the client signs that version.
    it("is given on a package draft older than the request, once filled in", async () => {
      seedTemplate("tpl-consent", "CONSENT", {
        name: "Anaesthesia consent",
        assigned: false,
      });
      seedTemplateInstance("package-draft", "tpl-consent", null);
      await FormAssignmentService.createForAppointment({
        organisationId: ORG,
        appointmentId: APPOINTMENT,
        templateId: "tpl-consent",
        createdBy: "SYSTEM",
      });

      const staffSave = await submitFromPms("tpl-consent");
      expect(staffSave._id).toBe("package-draft");
      armDocumenso();
      await startClientSigning(staffSave._id);
      const [document] = [...store.renderedDocuments.values()];
      await completePersistedRenderedDocumentSigning(document.id as string);

      expect(store.formAssignments[0].status).toBe("SIGNED");
      await expect(listConsentDocuments()).resolves.toEqual([
        expect.objectContaining({ signingStatus: "SIGNED" }),
      ]);
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

    // A form the practice filled in is a practice record: shown once signed,
    // and never when marked Internal and not sent to the parent.
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
      await expect(listForParent()).resolves.toEqual([]);

      for (const document of [...store.renderedDocuments.values()]) {
        await signAndComplete(document.id as string);
      }
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
