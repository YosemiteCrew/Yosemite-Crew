import { Form, FormField } from "@yosemite-crew/types";
import { model, Schema } from "mongoose";

// Schema for Form

const FormSchema = new Schema<Form>(
  {
    orgId: { type: String, required: true },

    businessType: {
      type: String,
      enum: ["HOSPITAL", "BREEDER", "BOARDER", "GROOMER"],
      required: false,
    },

    name: { type: String, required: true },
    category: { type: String, required: true },
    description: String,

    visibilityType: {
      type: String,
      enum: ["Internal", "External", "Internal_External"],
      required: true,
    },

    serviceId: {
      type: [String],
      default: undefined,
      required: false,
    },

    speciesFilter: {
      type: [String],
      default: undefined,
    },

    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },

    // Full schema JSON from frontend
    schema: {
      type: Schema.Types.Mixed, // stores FormField[]
      required: true,
      default: [],
    },

    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true },
  },
  { timestamps: true },
);

FormSchema.index({ orgId: 1, status: 1 });
FormSchema.index({ orgId: 1, category: 1 });
FormSchema.index({ orgId: 1, businessType: 1, category: 1, status: 1 });
FormSchema.index({ serviceId: 1 });
FormSchema.index({ status: 1 });

export const FormModel = model<Form>("Form", FormSchema);

// Schema for FormFeild

export interface FormFieldDocument {
  formId: Schema.Types.ObjectId; // Reference to Form

  id: string; // FE-generated stable ID
  type: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  order?: number;
  group?: string;

  options?: { label: string; value: string }[];

  meta?: Record<string, unknown>;
}

const FormFieldSchema = new Schema<FormFieldDocument>(
  {
    formId: { type: Schema.Types.ObjectId, ref: "Form", required: true },

    // IMPORTANT: FE field ID
    id: { type: String, required: true },

    type: { type: String, required: true },
    label: { type: String, required: true },

    placeholder: { type: String },
    required: { type: Boolean },
    order: { type: Number },
    group: { type: String },

    options: {
      type: [
        {
          label: String,
          value: String,
        },
      ],
    },

    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

FormFieldSchema.index({ formId: 1 });
FormFieldSchema.index({ type: 1 });

export const FormFieldModel = model<FormFieldDocument>(
  "FormField",
  FormFieldSchema,
);

// Schema for FormVersion

export interface IFormVersionDocument {
  formId: Schema.Types.ObjectId; // Reference to Form
  version: number;
  schemaSnapshot: FormField[];
  fieldsSnapshot: unknown[];
  publishedAt: Date;
}

const FormVersionSchema = new Schema<IFormVersionDocument>(
  {
    formId: { type: Schema.Types.ObjectId, ref: "Form", required: true },
    version: { type: Number, required: true },

    schemaSnapshot: {
      type: Schema.Types.Mixed, // stores array of FormField
      required: true,
    },

    fieldsSnapshot: {
      type: Schema.Types.Mixed, // normalized field rows
      required: true,
    },

    publishedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

FormVersionSchema.index({ formId: 1, version: 1 }, { unique: true });
FormVersionSchema.index({ formId: 1 });

export const FormVersionModel = model<IFormVersionDocument>(
  "FormVersion",
  FormVersionSchema,
);

// Schema for FormSubmission
export interface SigningInfo {
  required: boolean;

  status: "NOT_STARTED" | "IN_PROGRESS" | "SIGNED";

  provider: "DOCUMENSO";

  documentId?: string;

  signedAt?: Date;

  signer?: {
    userId?: string;
    email?: string;
    role: "CLIENT" | "VET";
  };

  pdf?: {
    url?: string;
    sha256?: string;
  };
}

export interface FormSubmissionDocument {
  formId: Schema.Types.ObjectId; // Reference to Form
  formVersion: number;
  appointmentId?: string;
  companionId?: string;
  parentId?: string;
  submittedBy?: string;
  answers: Record<string, unknown>;
  submittedAt: Date;
  signing?: SigningInfo;
}

const FormSubmissionSchema = new Schema<FormSubmissionDocument>(
  {
    formId: { type: Schema.Types.ObjectId, ref: "Form", required: true },
    formVersion: { type: Number, required: true },

    appointmentId: String,
    companionId: String,
    parentId: String,
    submittedBy: String,

    answers: {
      type: Schema.Types.Mixed,
      required: true,
    },

    submittedAt: { type: Date, default: Date.now },

    signing: {
      required: { type: Boolean, default: false },

      status: {
        type: String,
        enum: ["NOT_STARTED", "IN_PROGRESS", "SIGNED"],
      },

      provider: {
        type: String,
        enum: ["DOCUMENSO"],
      },

      documentId: String,

      signedAt: Date,

      signer: {
        userId: String,
        email: String,
        role: {
          type: String,
          enum: ["CLIENT", "VET"],
        },
      },

      pdf: {
        url: String,
        sha256: String,
      },
    },
  },
  { timestamps: true },
);

FormSubmissionSchema.index({ formId: 1 });
FormSubmissionSchema.index({ formId: 1, formVersion: 1 });
FormSubmissionSchema.index({ appointmentId: 1 });
FormSubmissionSchema.index({ companionId: 1 });
FormSubmissionSchema.index({ parentId: 1 });
FormSubmissionSchema.index({ submittedAt: -1 });
FormSubmissionSchema.index({ "signing.documentId": 1 });

export const FormSubmissionModel = model<FormSubmissionDocument>(
  "FormSubmission",
  FormSubmissionSchema,
);
