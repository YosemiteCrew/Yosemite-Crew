import { FormModel, FormSubmissionModel, FormVersionModel } from "src/models/form";
import { DocumensoService } from "./documenso.service";
import { generateFormSubmissionPdf } from "./formPDF.service";
import { ParentModel } from "src/models/parent";

export class FormSigningService {
  static async startSigning({
    submissionId,
    initiatedBy,
  }: {
    submissionId: string;
    initiatedBy?: string;
  }) {
    // 1️⃣ Load submission
    const submission = await FormSubmissionModel.findById(submissionId);
    if (!submission) {
      throw new Error("Form submission not found");
    }

    // 2️⃣ Validate state
    if (submission.signing?.status === "SIGNED") {
      throw new Error("Submission already signed");
    }

    // 3️⃣ Load immutable form version
    const version = await FormVersionModel.findOne({
      formId: submission.formId,
      version: submission.formVersion,
    }).lean();

    if (!version) {
      throw new Error("Form version not found");
    }

    const form = await FormModel.findById(submission.formId).lean();
    if (!form) {
      throw new Error("Form not found");
    }

    // 4️⃣ Generate PDF ONCE
    const pdf = await generateFormSubmissionPdf({
      title: form.name,
      schema: version.schemaSnapshot,
      answers: submission.answers,
      submittedAt: submission.submittedAt,
    });

    const parent = await ParentModel.findById(submission.parentId).lean();
    
    if(!parent){
      throw new Error("Unbale to find parent");
    }

    // 5️⃣ Resolve signer email
    const signerEmail = parent.email;

    if (!signerEmail) {
      throw new Error("Unable to resolve signer email");
    }

    // 6️⃣ Create Documenso document
    const doc = await DocumensoService.createDocument({
      pdf,
      signerEmail,
      signerName: parent.firstName + " " + parent.lastName,
    });

    if (!doc || typeof doc.id !== "number") {
      throw new Error("Unable to create Documenso document");
    }

    await DocumensoService.distributeDocument({
      documentId: doc.id,
    });

    // 7️⃣ Persist signing state
    submission.signing = {
      required: true,
      status: "IN_PROGRESS",
      provider: "DOCUMENSO",
      documentId: doc.id.toString(),
      signer: {
        email: signerEmail,
        role: initiatedBy ? "VET" : "CLIENT",
      },
    };

    await submission.save();

    return {
      documentId: doc.id,
      signingUrl: "",
    };
  }

  static async getSignedDocument({
    submissionId,
  }: {
    submissionId: string;
  }) {
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
    const signedPdf = await DocumensoService.downloadSignedDocument(
      Number.parseInt(submission.signing.documentId, 10),
    );

    if (!signedPdf) {
      throw new Error("Unable to download signed document");
    }

    return {
      pdf: signedPdf,
    };
  }
}
