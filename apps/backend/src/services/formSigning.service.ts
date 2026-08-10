import { DocumensoService } from "./documenso.service";
import logger from "src/utils/logger";
import { prisma } from "src/config/prisma";
import { Prisma } from "@prisma/client";
import {
  createRenderedDocumentRecord,
  signPersistedRenderedDocument,
} from "src/services/rendered-document.service";

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

  private static ensureParentOwnsSubmission(
    submissionParentId: unknown,
    initiatedBy?: string,
  ) {
    const ownerParentId = FormSigningService.normalizeId(submissionParentId);

    if (!ownerParentId || !initiatedBy || ownerParentId !== initiatedBy) {
      throw new Error("Unauthorized to sign this submission");
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
    const submission = await this.loadSubmissionOrThrowPrisma(submissionId);

    if (isParent) {
      FormSigningService.ensureParentOwnsSubmission(
        submission.parentId,
        initiatedBy,
      );
    }

    FormSigningService.ensureSigningCanStart(
      FormSigningService.extractSigningStatus(submission.signing),
    );

    const formId = submission.formId;
    const form = await FormSigningService.loadFormOrThrowPrisma(formId);

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

  static async getSignedDocument({ submissionId }: { submissionId: string }) {
    // 1️⃣ Load submission
    const submission = await this.loadSubmissionOrThrowPrisma(submissionId);

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
    const formId = submission.formId;
    const form = await FormSigningService.loadFormOrThrowPrisma(formId);

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
