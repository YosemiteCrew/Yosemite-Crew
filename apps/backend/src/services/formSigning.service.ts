import {
  FormModel,
  FormSubmissionModel,
  FormVersionModel,
} from "src/models/form";
import { type FormSubmissionDocument } from "src/models/form";
import { DocumensoService } from "./documenso.service";
import { generateFormSubmissionPdf } from "./formPDF.service";
import { ParentModel } from "src/models/parent";
import UserModel from "src/models/user";
import logger from "src/utils/logger";
import { prisma } from "src/config/prisma";
import { handleDualWriteError, shouldDualWrite } from "src/utils/dual-write";
import { Prisma } from "@prisma/client";
import { type HydratedDocument, Types } from "mongoose";
import { isReadFromPostgres } from "src/config/read-switch";
import type { FormField } from "@yosemite-crew/types";

type FormSubmissionDoc = HydratedDocument<FormSubmissionDocument> & {
  _id: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
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

  private static async loadSubmissionOrThrowPrisma(submissionId: string) {
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

  private static async loadVersionOrThrow(formId: string, version: number) {
    const formVersion = await FormVersionModel.findOne({
      formId,
      version,
    }).lean();
    if (!formVersion) {
      throw new Error("Form version not found");
    }
    return formVersion;
  }

  private static async loadVersionOrThrowPrisma(
    formId: string,
    version: number,
  ) {
    const formVersion = await prisma.formVersion.findUnique({
      where: { formId_version: { formId, version } },
    });
    if (!formVersion) {
      throw new Error("Form version not found");
    }
    return formVersion;
  }

  private static ensureNotAlreadySigned(status?: string) {
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

  private static async resolveDocumensoKeyOrThrow(orgId: string) {
    const apiKey = isReadFromPostgres()
      ? ((
          await prisma.organization.findUnique({
            where: { id: orgId },
            select: { documensoApiKey: true },
          })
        )?.documensoApiKey ?? null)
      : await DocumensoService.resolveOrganisationApiKey(orgId);
    if (!apiKey) {
      throw new Error("Documenso API key not configured for organisation");
    }
    return apiKey;
  }

  private static async resolveSignerInfo({
    isParent,
    initiatedBy,
  }: {
    isParent?: boolean;
    initiatedBy?: string;
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

    const user = isReadFromPostgres()
      ? await prisma.user.findUnique({ where: { userId: initiatedBy ?? "" } })
      : await UserModel.findOne({ userId: initiatedBy }).lean();
    if (!user) {
      throw new Error("Unable to find submitting user");
    }
    return {
      signerEmail: user.email,
      signerName: user.firstName + " " + user.lastName,
      signerRole: "VET" as const,
    };
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

      FormSigningService.ensureNotAlreadySigned(
        FormSigningService.extractSigningStatus(submission.signing),
      );

      const formId = submission.formId;
      const version = await FormSigningService.loadVersionOrThrowPrisma(
        formId,
        submission.formVersion,
      );

      const form = await FormSigningService.loadFormOrThrowPrisma(formId);
      FormSigningService.ensureRequiredSignerMatches(
        form.requiredSigner ?? undefined,
        isParent,
      );

      const documensoApiKey =
        await FormSigningService.resolveDocumensoKeyOrThrow(form.orgId);

      const pdf = await generateFormSubmissionPdf({
        title: form.name,
        schema: version.schemaSnapshot as unknown as FormField[],
        answers: submission.answers as unknown as Record<string, unknown>,
        submittedAt: submission.submittedAt,
      });

      const { signerEmail, signerName, signerRole } =
        await FormSigningService.resolveSignerInfo({
          isParent,
          initiatedBy,
        });

      if (!signerEmail) {
        logger.error("Signer email is missing");
        throw new Error("Signer email is required for signing");
      }

      const doc = await DocumensoService.createDocument({
        pdf,
        signerEmail,
        signerName: signerName,
        apiKey: documensoApiKey,
      });

      if (!doc || typeof doc.id !== "number") {
        throw new Error("Unable to create Documenso document");
      }

      await DocumensoService.distributeDocument({
        documentId: doc.id,
        apiKey: documensoApiKey,
      });

      await prisma.formSubmission.update({
        where: { id: submission.id },
        data: {
          signing: {
            required: true,
            status: "IN_PROGRESS",
            provider: "DOCUMENSO",
            documentId: doc.id.toString(),
            signer: {
              email: signerEmail,
              role: signerRole,
            },
          } as unknown as Prisma.InputJsonValue,
        },
      });

      return {
        documentId: doc.id,
        signingUrl: `${process.env.DOCUMENSO_URL}/sign/${doc.recipients[0].token}`,
      };
    }

    // 1️⃣ Load submission
    const submission =
      await FormSigningService.loadSubmissionOrThrow(submissionId);

    // 2️⃣ Validate state
    FormSigningService.ensureNotAlreadySigned(submission.signing?.status);

    // 3️⃣ Load immutable form version
    const formId = (() => {
      if (typeof submission.formId === "string") return submission.formId;
      if (hasToHexString(submission.formId)) {
        const id = submission.formId.toHexString();
        if (id.length > 0) return id;
      }
      throw new Error("Invalid formId");
    })();

    const version = await FormSigningService.loadVersionOrThrow(
      formId,
      submission.formVersion,
    );

    const form = await FormSigningService.loadFormOrThrow(formId);
    FormSigningService.ensureRequiredSignerMatches(
      form.requiredSigner,
      isParent,
    );

    const documensoApiKey = await FormSigningService.resolveDocumensoKeyOrThrow(
      form.orgId,
    );

    // 4️⃣ Generate PDF ONCE
    const pdf = await generateFormSubmissionPdf({
      title: form.name,
      schema: version.schemaSnapshot,
      answers: submission.answers,
      submittedAt: submission.submittedAt,
    });

    const { signerEmail, signerName, signerRole } =
      await FormSigningService.resolveSignerInfo({
        isParent,
        initiatedBy,
      });

    if (!signerEmail) {
      logger.error("Signer email is missing");
      throw new Error("Signer email is required for signing");
    }

    // 6️⃣ Create Documenso document
    const doc = await DocumensoService.createDocument({
      pdf,
      signerEmail,
      signerName: signerName,
      apiKey: documensoApiKey,
    });

    if (!doc || typeof doc.id !== "number") {
      throw new Error("Unable to create Documenso document");
    }

    await DocumensoService.distributeDocument({
      documentId: doc.id,
      apiKey: documensoApiKey,
    });

    // 7️⃣ Persist signing state
    submission.signing = {
      required: true,
      status: "IN_PROGRESS",
      provider: "DOCUMENSO",
      documentId: doc.id.toString(),
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
      documentId: doc.id,
      signingUrl: `${process.env.DOCUMENSO_URL}/sign/${doc.recipients[0].token}`,
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
