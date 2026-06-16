import { FormModel, FormSubmissionModel } from "src/models/form";
import { type FormSubmissionDocument } from "src/models/form";
import { DocumensoService } from "./documenso.service";
import { ParentModel } from "src/models/parent";
import UserModel from "src/models/user";
import logger from "src/utils/logger";
import { prisma } from "src/config/prisma";
import { handleDualWriteError, shouldDualWrite } from "src/utils/dual-write";
import { Prisma } from "@prisma/client";
import { type HydratedDocument, Types } from "mongoose";
import { isReadFromPostgres } from "src/config/read-switch";
import {
  createRenderedDocumentRecord,
  signPersistedRenderedDocument,
} from "src/services/rendered-document.service";

type FormSubmissionDoc = HydratedDocument<FormSubmissionDocument> & {
  _id: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};

type PrismaFormSubmissionRecord = {
  id: string;
  formId: string;
  formVersion: number;
  appointmentId: string | null;
  companionId: string | null;
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

  private static async loadSubmissionOrThrow(
    submissionId: string,
  ): Promise<FormSubmissionDoc> {
    const submission = await FormSubmissionModel.findById(submissionId);
    if (!submission) {
      throw new Error("Form submission not found");
    }
    return submission;
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

  private static async loadFormOrThrow(formId: string) {
    const form = await FormModel.findById(formId).lean();
    if (!form) {
      throw new Error("Form not found");
    }
    return form;
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
      const parent = isReadFromPostgres()
        ? await prisma.parent.findUnique({ where: { id: initiatedBy } })
        : await ParentModel.findById(initiatedBy).lean();
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

    const user = isReadFromPostgres()
      ? await prisma.user.findUnique({ where: { userId: submittedBy } })
      : await UserModel.findOne({ userId: submittedBy }).lean();
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

  static async startSigning({
    isParent,
    submissionId,
    initiatedBy,
  }: {
    isParent?: boolean;
    submissionId: string;
    initiatedBy?: string;
  }) {
    if (isReadFromPostgres()) {
      const submission =
        await FormSigningService.loadSubmissionOrThrowPrisma(submissionId);

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

      const sourceId =
        FormSigningService.normalizeId(submission.id) ??
        FormSigningService.normalizeId((submission as { _id?: unknown })._id);
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
                  | { documentId?: string }
                  | null
                  | undefined
              )?.documentId ?? renderedDocument.id,
            signer: {
              email: signerEmail,
              role: signerRole,
            },
          } as unknown as Prisma.InputJsonValue,
        },
      });

      return {
        documentId:
          (
            signedRenderedDocument.signing as
              | { documentId?: string }
              | null
              | undefined
          )?.documentId ?? renderedDocument.id,
        signingUrl:
          (
            signedRenderedDocument.signing as
              | { signingUrl?: string }
              | null
              | undefined
          )?.signingUrl ?? null,
      };
    }

    // 1️⃣ Load submission
    const submission =
      await FormSigningService.loadSubmissionOrThrow(submissionId);

    if (isParent) {
      FormSigningService.ensureParentOwnsSubmission(
        submission.parentId,
        initiatedBy,
      );
    }

    // 2️⃣ Validate state
    FormSigningService.ensureSigningCanStart(submission.signing?.status);

    // 3️⃣ Load immutable form version
    const formId = (() => {
      if (typeof submission.formId === "string") return submission.formId;
      if (hasToHexString(submission.formId)) {
        const id = submission.formId.toHexString();
        if (id.length > 0) return id;
      }
      throw new Error("Invalid formId");
    })();

    const form = await FormSigningService.loadFormOrThrow(formId);
    FormSigningService.ensureRequiredSignerMatches(
      form.requiredSigner,
      isParent,
    );

    const { signerEmail, signerName, signerRole } =
      await FormSigningService.resolveSignerInfo({
        isParent,
        initiatedBy,
        submittedBy: submission.submittedBy,
      });

    const sourceId =
      FormSigningService.normalizeId(submission.id) ??
      FormSigningService.normalizeId((submission as { _id?: unknown })._id);
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

    // 7️⃣ Persist signing state
    submission.signing = {
      required: true,
      status: "IN_PROGRESS",
      provider: "DOCUMENSO",
      documentId:
        (
          signedRenderedDocument.signing as
            | { documentId?: string }
            | null
            | undefined
        )?.documentId ?? renderedDocument.id,
      signer: {
        email: signerEmail,
        role: signerRole,
      },
    };

    await submission.save();

    if (shouldDualWrite) {
      try {
        await prisma.formSubmission.updateMany({
          where: { id: submission._id.toString() },
          data: {
            signing: submission.signing as unknown as Prisma.InputJsonValue,
            updatedAt: submission.updatedAt ?? undefined,
          },
        });
      } catch (err) {
        handleDualWriteError("FormSubmission signing", err);
      }
    }
    return {
      documentId:
        (
          signedRenderedDocument.signing as
            | { documentId?: string }
            | null
            | undefined
        )?.documentId ?? renderedDocument.id,
      signingUrl:
        (
          signedRenderedDocument.signing as
            | { signingUrl?: string }
            | null
            | undefined
        )?.signingUrl ?? null,
    };
  }

  static async getSignedDocument({ submissionId }: { submissionId: string }) {
    // 1️⃣ Load submission
    const submission = isReadFromPostgres()
      ? await FormSigningService.loadSubmissionOrThrowPrisma(submissionId)
      : await FormSubmissionModel.findById(submissionId);
    if (!submission) {
      throw new Error("Form submission not found");
    }

    // 2️⃣ Validate signing state
    const signing = submission.signing as
      | { status?: string; documentId?: string }
      | null
      | undefined;
    const signingStatus = isReadFromPostgres()
      ? FormSigningService.extractSigningStatus(
          submission.signing as Prisma.JsonValue | null | undefined,
        )
      : signing?.status;
    if (signingStatus !== "SIGNED") {
      throw new Error("Submission is not signed yet");
    }

    const documentId = isReadFromPostgres()
      ? FormSigningService.extractDocumentId(
          submission.signing as Prisma.JsonValue | null | undefined,
        )
      : signing?.documentId;

    if (!documentId) {
      throw new Error("No document associated with this submission");
    }

    // 3️⃣ Fetch signed document from Documenso
    const formId =
      typeof submission.formId === "string"
        ? submission.formId
        : hasToHexString(submission.formId)
          ? submission.formId.toHexString()
          : (() => {
              throw new Error("Invalid formId on submission");
            })();
    const form = isReadFromPostgres()
      ? await FormSigningService.loadFormOrThrowPrisma(formId)
      : await FormModel.findById(submission.formId).lean();

    if (!form) {
      throw new Error("Form not found");
    }

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
