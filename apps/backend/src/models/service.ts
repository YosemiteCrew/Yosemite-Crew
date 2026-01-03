import { Schema, model, HydratedDocument, Types } from "mongoose";

export interface ServiceMongo {
  organisationId: Types.ObjectId;
  name: string;
  description?: string | null;
  durationMinutes: number;
  cost: number;
  maxDiscount?: number | null;
  specialityId?: Types.ObjectId | null;
  serviceType?: "CONSULTATION" | "OBSERVATION_TOOL";
  observationToolId?: Types.ObjectId | null;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const ServiceSchema = new Schema<ServiceMongo>(
  {
    organisationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    name: { type: String, required: true, trim: true, index: "text" },
    description: { type: String, default: null },

    durationMinutes: { type: Number, required: true },
    cost: { type: Number, required: true },
    maxDiscount: { type: Number, default: null },

    specialityId: {
      type: Schema.Types.ObjectId,
      ref: "Speciality",
      default: null,
    },

    serviceType: {
      type: String,
      enum: ["CONSULTATION", "OBSERVATION_TOOL"],
      default: "CONSULTATION",
    },

    observationToolId: {
      type: Schema.Types.ObjectId,
      ref: "ObservationToolDefinition",
      default: null,
    },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

ServiceSchema.index({
  name: "text",
  description: "text",
});
ServiceSchema.index({ organisationId: 1, specialityId: 1 });

export type ServiceDocument = HydratedDocument<ServiceMongo>;

const ServiceModel = model<ServiceMongo>("Service", ServiceSchema);
export default ServiceModel;
