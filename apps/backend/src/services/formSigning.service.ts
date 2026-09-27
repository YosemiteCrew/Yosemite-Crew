import { DocumensoService } from "./documenso.service";
import logger from "src/utils/logger";
import { parentHasCompanionFeature } from "src/middlewares/companion-access";
import { isPracticeOnlyForm } from "src/services/form.service";
import { prisma } from "src/config/prisma";
import { Prisma } from "@prisma/client";
import {
  createRenderedDocumentRecord,
  hasNewerSubmissionForSigner,
  signPersistedRenderedDocument,
} from "src/services/rendered-document.service";
import {
  instanceNeedsClientSignature,
  isOpenSigning,
  requestsAnsweredBy,
} from "src/services/client-signature.helpers";
import { TemplateService } from "src/services/template.service";

// The companion an appointment is for.
const resolvePatientIdOf = (appointment: { patient: unknown }) => {
  const id = (appointment.patient as { id?: unknown } | null)?.id;
  return typeof id === "string" ? id : undefined;
};

type PrismaFormSubmissionRecord = {
  id: string;
  formId: string;
  formVersion: number;
  appointmentId: string | null;
  patientId: string | null;
  parentId: string | null;
  submittedBy: string | null;
  answers: Prisma.JsonValue;
  submittedAt: Date;
  signing: Prisma.JsonValue | null;
};

const hasToHexString = (
  value: unknown,
): value is { toHexString: () => string } => {
  if (!value || typeof value !== "object") return false;
  return (
    "toHexString" in value &&
    typeof (value as { toHexString?: unknown }).toHexString === "function"
  );
};

export class FormSigningService {
  private static normalizeId(value: unknown): string | undefined {
    if (typeof value === "string" && value.length > 0) {
      return value;
    }

    if (hasToHexString(value)) {
      const id = value.toHexString();
      return id.length > 0 ? id : undefined;
    }

    if (
      value &&
      typeof value === "object" &&
      typeof (value as { toString?: unknown }).toString === "function"
    ) {
      const id = (value as { toString: () => string }).toString();
      return id.length > 0 && id !== "[object Object]" ? id : undefined;
    }

    return undefined;
  }

  private static extractSigningStatus(
    signing: Prisma.JsonValue | null | undefined,
  ) {
    if (!signing || typeof signing !== "object" || Array.isArray(signing)) {
      return undefined;
    }
    const status = (signing as Record<string, unknown>).status;
    return typeof status === "string" ? status : undefined;
  }

  private static extractDocumentId(
    signing: Prisma.JsonValue | null | undefined,
  ) {
    if (!signing || typeof signing !== "object" || Array.isArray(signing)) {
      return undefined;
    }
    const documentId = (signing as Record<string, unknown>).documentId;
    return typeof documentId === "string" ? documentId : undefined;
  }

  private static async loadSubmissionOrThrowPrisma(
    submissionId: string,
  ): Promise<PrismaFormSubmissionRecord> {
    const submission = await prisma.formSubmission.findUnique({
      where: { id: submissionId },
    });
    if (!submission) {
      throw new Error("Form submission not found");
    }
    return submission;
  }

  private static async loadFormOrThrowPrisma(formId: string) {
    const form = await prisma.form.findUnique({ where: { id: formId } });
    if (!form) {
      throw new Error("Form not found");
    }
    return form;
  }

  private static ensureSigningCanStart(status?: string) {
    if (status === "IN_PROGRESS") {
      throw new Error("Submission signing is already in progress");
    }
    if (status === "SIGNED") {
      throw new Error("Submission already signed");
    }
  }

  private static ensureRequiredSignerMatches(
    requiredSigner?: string,
    isParent?: boolean,
  ) {
    if (!requiredSigner) {
      return;
    }

    const requiresParent = requiredSigner === "CLIENT";
    if (requiresParent && !isParent) {
      throw new Error("Form requires client signature");
    }
    if (!requiresParent && isParent) {
      throw new Error("Form requires vet signature");
    }
  }

  private static async resolveSignerInfo({
    isParent,
    initiatedBy,
    submittedBy,
  }: {
    isParent?: boolean;
    initiatedBy?: string;
    submittedBy?: string;
  }) {
    if (isParent) {
      logger.info("Signing initiated by parent: ", initiatedBy);
      const parent = await prisma.parent.findUnique({
        where: { id: initiatedBy },
      });
      if (!parent) {
        throw new Error("Unbale to find parent");
      }
      return {
        signerEmail: parent.email,
        signerName: parent.firstName + " " + parent.lastName,
        signerRole: "CLIENT" as const,
      };
    }

    if (!submittedBy) {
      throw new Error("Unable to find submitting user");
    }

    const user = await prisma.user.findUnique({
      where: { userId: submittedBy },
    });
    if (!user) {
      throw new Error("Unable to find submitting user");
    }
    return {
      signerEmail: user.email,
      signerName: user.firstName + " " + user.lastName,
      signerRole: "VET" as const,
    };
  }

  private static async createAndStartRenderedDocumentSigning({
    formId,
    formName,
    formOrgId,
    formVersion,
    sourceId,
    signerEmail,
    signerName,
    signerId,
    signerType,
  }: {
    formId: string;
    formName: string;
    formOrgId: string;
    formVersion: number;
    sourceId: string;
    signerEmail: string;
    signerName: string;
    signerId: string;
    signerType: "PARENT" | "PMS_USER";
  }) {
    const renderedDocument = await createRenderedDocumentRecord({
      title: formName,
      source: {
        sourceKind: "FORM_SUBMISSION",
        sourceId,
        organisationId: formOrgId,
        templateKind: "FORM",
        templateId: formId,
        templateVersion: formVersion,
      },
    });

    const signedRenderedDocument = await signPersistedRenderedDocument({
      renderedDocumentId: renderedDocument.id,
      organisationId: formOrgId,
      signerId,
      signerType,
      signerEmail,
      signerName,
    });

    return { renderedDocument, signedRenderedDocument };
  }

  /**
   * A parent signs a submission that names them, for a companion they hold an
   * ACTIVE link to. A co-parent needs "appointments" for a form they filled in
   * and "medicalRecords" for one the practice wrote, as for reading it. Any
   * other submission is answered as a missing one.
   */
  private static async ensureParentOwnsSubmission(
    submission: Pick<
      PrismaFormSubmissionRecord,
      "parentId" | "patientId" | "submittedBy"
    >,
    initiatedBy?: string,
  ) {
    const ownerParentId = FormSigningService.normalizeId(submission.parentId);

    if (
      !ownerParentId ||
      !initiatedBy ||
      ownerParentId !== initiatedBy ||
      !(await parentHasCompanionFeature(
        initiatedBy,
        submission.patientId,
        submission.submittedBy === initiatedBy
          ? "appointments"
          : "medicalRecords",
      ))
    ) {
      throw new Error("Form submission not found");
    }
  }

  /**
   * A parent signs a form the practice filled in, or a practice-only one, only
   * where the form names the client as its signer, and never an internal form.
   * Anything else is answered as a missing submission.
   */
  private static ensureParentMaySignForm(
    form: {
      requiredSigner: string | null;
      category: string;
      visibilityType: string | null;
    },
    submittedBy?: string,
    initiatedBy?: string,
  ) {
    if (
      form.visibilityType === "Internal" ||
      (form.requiredSigner !== "CLIENT" &&
        (submittedBy !== initiatedBy || isPracticeOnlyForm(form)))
    ) {
      throw new Error("Form submission not found");
    }
  }

  /**
   * Authorise a PMS (non-parent) signing request. The acting user (derived from
   * the verified token) must be the user who submitted the form, and the form
   * must belong to the organisation the caller is authorised for. This prevents
   * any PMS user who merely knows a submissionId from minting a Documenso signing
   * token for another user's submission (cross-user / cross-tenant).
   */
  private static ensurePmsUserCanSign({
    formOrgId,
    organisationId,
    submittedBy,
    initiatedBy,
  }: {
    formOrgId?: string;
    organisationId?: string;
    submittedBy?: string;
    initiatedBy?: string;
  }) {
    if (organisationId && formOrgId && formOrgId !== organisationId) {
      throw new Error("Unauthorized to sign this submission");
    }

    if (!submittedBy || !initiatedBy || submittedBy !== initiatedBy) {
      throw new Error("Unauthorized to sign this submission");
    }
  }

  /**
   * A template-backed form or consent is a template instance with a rendered
   * document, not a form submission, so the parent signs that document:
   * whether they submitted it from the app or the practice filled it in for
   * them. Only on an appointment of a companion they may act for (the same
   * rule as submitting it), for a template the practice asked them to sign. A
   * signing already started for them is handed back, so it can be reopened.
   */
  private static async startTemplateInstanceSigning(
    instanceId: string,
    parentId: string,
  ) {
    const instance = await prisma.templateInstance.findUnique({
      where: { id: instanceId },
      select: {
        id: true,
        organisationId: true,
        templateId: true,
        appointmentId: true,
        authorId: true,
        createdAt: true,
        generatedPdf: true,
        template: { select: { kind: true, rules: true } },
      },
    });
    if (!instance?.appointmentId) {
      throw new Error("Form submission not found");
    }
    const ownAnswers = instance.authorId === parentId;
    // As for a form submission (ensureRequiredSignerMatches): who signs is
    // the one pinned when it was submitted, and a consent that names no one
    // is the client's. Answers the parent did not give are theirs to sign
    // only where the client signs; otherwise they are answered as missing.
    if (!instanceNeedsClientSignature(instance)) {
      throw new Error(
        ownAnswers
          ? "Form requires vet signature"
          : "Form submission not found",
      );
    }

    const appointment = await prisma.appointment.findFirst({
      where: {
        id: instance.appointmentId,
        organisationId: instance.organisationId,
      },
      select: { patient: true },
    });
    // The rule for a form submission: a co-parent needs "appointments" for
    // answers they gave and "medicalRecords" for any others. A parent who may
    // not sign is answered as if there were nothing to sign.
    if (
      !appointment ||
      !(await parentHasCompanionFeature(
        parentId,
        resolvePatientIdOf(appointment),
        ownAnswers ? "appointments" : "medicalRecords",
      ))
    ) {
      throw new Error("Form submission not found");
    }

    // A request these answers are for: never one sent after them, or after
    // the request they were given to was withdrawn.
    const answered = await requestsAnsweredBy(prisma, {
      organisationId: instance.organisationId,
      templateId: instance.templateId,
      appointmentId: instance.appointmentId,
      authorId: instance.authorId,
      createdAt: instance.createdAt,
    });
    const assignment =
      answered &&
      (await prisma.formAssignment.findFirst({
        where: { ...answered, signingRequired: true, mobileVisible: true },
        select: { id: true },
      }));
    if (!assignment) {
      throw new Error("Form submission not found");
    }

    if (
      await hasNewerSubmissionForSigner(
        prisma,
        {
          id: instance.id,
          organisationId: instance.organisationId,
          templateId: instance.templateId,
          appointmentId: instance.appointmentId,
          authorId: instance.authorId,
          createdAt: instance.createdAt,
        },
        parentId,
      )
    ) {
      throw new Error(
        "A newer version of this form is waiting for your signature",
      );
    }

    // One submitted before submitting rendered a document is rendered now.
    const document =
      (await prisma.renderedDocument.findUnique({
        where: { templateInstanceId: instance.id },
        select: { id: true, signing: true },
      })) ??
      (await TemplateService.renderMissingDocument(
        instance.id,
        instance.organisationId,
      ));
    if (!document) {
      throw new Error("Submission has no document to sign yet");
    }

    const open = document.signing as {
      signerId?: string;
      documentId?: string;
      signingUrl?: string | null;
      awaitingSend?: boolean;
    } | null;
    // Only a signing Documenso sent to them: one still waiting for its send
    // (or never sent) is not handed out, and expires so it can be sent anew.
    if (
      isOpenSigning(open) &&
      open?.awaitingSend !== true &&
      open?.documentId &&
      open.signerId === parentId
    ) {
      return {
        documentId: open.documentId,
        signingUrl: open.signingUrl ?? null,
      };
    }

    const { signerEmail, signerName } =
      await FormSigningService.resolveSignerInfo({
        isParent: true,
        initiatedBy: parentId,
      });
    if (!signerEmail) {
      throw new Error("Signer email is required for signing");
    }

    const signed = await signPersistedRenderedDocument({
      renderedDocumentId: document.id,
      organisationId: instance.organisationId,
      signerId: parentId,
      signerType: "PARENT",
      signerEmail,
      signerName,
    });
    const signing = signed.signing as {
      documentId?: string;
      signingUrl?: string | null;
    } | null;

    return {
      documentId: signing?.documentId ?? document.id,
      signingUrl: signing?.signingUrl ?? null,
    };
  }

  static async startSigning({
    isParent,
    submissionId,
    initiatedBy,
    organisationId,
  }: {
    isParent?: boolean;
    submissionId: string;
    initiatedBy?: string;
    organisationId?: string;
  }) {
    const submission = await prisma.formSubmission.findUnique({
      where: { id: submissionId },
    });
    if (!submission) {
      if (isParent && initiatedBy) {
        return FormSigningService.startTemplateInstanceSigning(
          submissionId,
          initiatedBy,
        );
      }
      throw new Error("Form submission not found");
    }
    const formId = submission.formId;
    let form:
      | Awaited<ReturnType<typeof FormSigningService.loadFormOrThrowPrisma>>
      | undefined;

    if (isParent) {
      await FormSigningService.ensureParentOwnsSubmission(
        submission,
        initiatedBy,
      );
      form = await FormSigningService.loadFormOrThrowPrisma(formId);
      FormSigningService.ensureParentMaySignForm(
        form,
        submission.submittedBy ?? undefined,
        initiatedBy,
      );
    }

    FormSigningService.ensureSigningCanStart(
      FormSigningService.extractSigningStatus(submission.signing),
    );

    form ??= await FormSigningService.loadFormOrThrowPrisma(formId);

    if (!isParent) {
      FormSigningService.ensurePmsUserCanSign({
        formOrgId: form.orgId,
        organisationId,
        submittedBy: submission.submittedBy ?? undefined,
        initiatedBy,
      });
    }

    FormSigningService.ensureRequiredSignerMatches(
      form.requiredSigner ?? undefined,
      isParent,
    );

    const { signerEmail, signerName, signerRole } =
      await FormSigningService.resolveSignerInfo({
        isParent,
        initiatedBy,
        submittedBy: submission.submittedBy ?? undefined,
      });

    const sourceId = FormSigningService.normalizeId(submission.id);
    if (!sourceId) {
      throw new Error("Unable to determine submission id");
    }

    if (!signerEmail) {
      logger.error("Signer email is missing");
      throw new Error("Signer email is required for signing");
    }

    const { renderedDocument, signedRenderedDocument } =
      await FormSigningService.createAndStartRenderedDocumentSigning({
        formId,
        formName: form.name,
        formOrgId: form.orgId,
        formVersion: submission.formVersion,
        sourceId,
        signerEmail,
        signerName,
        signerId: isParent
          ? (initiatedBy ?? "")
          : (submission.submittedBy ?? ""),
        signerType: isParent ? "PARENT" : "PMS_USER",
      });

    await prisma.formSubmission.update({
      where: { id: submission.id },
      data: {
        signing: {
          required: true,
          status: "IN_PROGRESS",
          provider: "DOCUMENSO",
          documentId:
            (
              signedRenderedDocument.signing as
                { documentId?: string } | null | undefined
            )?.documentId ?? renderedDocument.id,
          signer: {
            email: signerEmail,
            role: signerRole,
          },
        },
      },
    });

    return {
      documentId:
        (
          signedRenderedDocument.signing as
            { documentId?: string } | null | undefined
        )?.documentId ?? renderedDocument.id,
      signingUrl:
        (
          signedRenderedDocument.signing as
            { signingUrl?: string } | null | undefined
        )?.signingUrl ?? null,
    };
  }

  static async getSignedDocument({
    submissionId,
    organisationId,
  }: {
    submissionId: string;
    organisationId: string;
  }) {
    // 1️⃣ Load submission and its form
    const submission = await this.loadSubmissionOrThrowPrisma(submissionId);
    const form = await FormSigningService.loadFormOrThrowPrisma(
      submission.formId,
    );

    // A submission of another organisation's form is reported exactly as a
    // missing one, before its signing state is read.
    if (form.orgId !== organisationId) {
      throw new Error("Form submission not found");
    }

    // 2️⃣ Validate signing state
    const signingStatus = FormSigningService.extractSigningStatus(
      submission.signing,
    );
    if (signingStatus !== "SIGNED") {
      throw new Error("Submission is not signed yet");
    }

    const documentId = FormSigningService.extractDocumentId(submission.signing);

    if (!documentId) {
      throw new Error("No document associated with this submission");
    }

    // 3️⃣ Fetch signed document from Documenso
    const documensoApiKey = await DocumensoService.resolveOrganisationApiKey(
      form.orgId,
    );

    if (!documensoApiKey) {
      throw new Error("Documenso API key not configured for organisation");
    }

    const signedPdf = await DocumensoService.downloadSignedDocument({
      documentId: Number.parseInt(documentId, 10),
      apiKey: documensoApiKey,
    });

    if (!signedPdf) {
      throw new Error("Unable to download signed document");
    }

    return {
      pdf: signedPdf,
    };
  }
}
