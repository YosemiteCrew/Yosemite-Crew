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
  private static async loadSubmissionOrThrow(
    submissionId: string,
  ): Promise<FormSubmissionDoc> {
    const submission = await FormSubmissionModel.findById(submissionId);
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
    const apiKey = await DocumensoService.resolveOrganisationApiKey(orgId);
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
      const parent = await ParentModel.findById(initiatedBy).lean();
      if (!parent) {
        throw new Error("Unbale to find parent");
      }
      return {
        signerEmail: parent.email,
        signerName: parent.firstName + " " + parent.lastName,
        signerRole: "CLIENT" as const,
      };
    }

    const user = await UserModel.findOne({ userId: initiatedBy }).lean();
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
    const submission = await FormSubmissionModel.findById(submissionId);
    if (!submission) {
      throw new Error("Form submission not found");
    }

    // 2️⃣ Validate signing state
    if (submission.signing?.status !== "SIGNED") {
      throw new Error("Submission is not signed yet");
    }

    if (!submission.signing.documentId) {
      throw new Error("No document associated with this submission");
    }

    // 3️⃣ Fetch signed document from Documenso
    const form = await FormModel.findById(submission.formId).lean();

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
      documentId: Number.parseInt(submission.signing.documentId, 10),
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
