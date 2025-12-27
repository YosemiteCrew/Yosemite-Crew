import { Schema, model, HydratedDocument } from "mongoose";

export type TaskStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type RecurrenceType = "ONCE" | "DAILY" | "WEEKLY" | "CUSTOM";

interface TaskMongo {
  organisationId?: string;
  appointmentId?: string;

  companionId?: string;

  createdBy: string;
  assignedBy?: string;
  assignedTo: string;

  audience: "EMPLOYEE_TASK" | "PARENT_TASK";

  source: "YC_LIBRARY" | "ORG_TEMPLATE" | "CUSTOM";
  libraryTaskId?: string;
  templateId?: string;

  category: string;
  name: string;
  description?: string;

  medication?: {
    name?: string;
    type?: string;
    notes?: string;
    doses?: {
      dosage?: string;
      time?: string;       
      frequency?: string;  
    }[];
  };
  
  observationToolId?: string;

  dueAt: Date;
  timezone?: string;

  recurrence?: {
    type: RecurrenceType;
    isMaster: boolean;
    masterTaskId?: string;
    cronExpression?: string;
    endDate?: Date;
  };

  reminder?: {
    enabled: boolean;
    offsetMinutes: number;
    scheduledNotificationId?: string;
  };

  syncWithCalendar?: boolean;
  calendarEventId?: string;

  attachments?: {
    id: string;
    name: string;
  }[];

  status: TaskStatus;
  completedAt?: Date;
  completedBy?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

const MedicationDoseSchema = new Schema(
  {
    dosage: { type: String, required: true },
    time: { type: String },        // Optional: HH:mm
    frequency: { type: String },   // Optional: BID, TID, DAILY
  },
  { _id: false },
)

const MedicationSchema = new Schema(
  {
    name: { type: String, required: true },
    type: String,
    notes: String,
    doses: {
      type: [MedicationDoseSchema],
      required: true,
      validate: [
        (v: unknown[]) => Array.isArray(v) && v.length > 0,
        "At least one dose is required for medication task",
      ],
    },
  },
  { _id: false },
);

const RecurrenceSchema = new Schema(
  {
    type: { type: String, enum: ["ONCE", "DAILY", "WEEKLY", "CUSTOM"] },
    isMaster: Boolean,
    masterTaskId: String,
    cronExpression: String,
    endDate: Date,
  },
  { _id: false },
);

const ReminderSchema = new Schema(
  {
    enabled: Boolean,
    offsetMinutes: Number,
    scheduledNotificationId: String,
  },
  { _id: false },
);

const AttachmentSchema = new Schema(
  {
    id: String,
    name: String,
  },
  { _id: false },
);

const TaskSchema = new Schema<TaskMongo>(
  {
    organisationId: String,
    appointmentId: String,

    companionId: String,

    createdBy: { type: String, required: true },
    assignedBy: String,
    assignedTo: { type: String, required: true },

    audience: {
      type: String,
      enum: ["EMPLOYEE_TASK", "PARENT_TASK"],
      required: true,
    },

    source: {
      type: String,
      enum: ["YC_LIBRARY", "ORG_TEMPLATE", "CUSTOM"],
      required: true,
    },
    libraryTaskId: String,
    templateId: String,

    category: String,
    name: String,
    description: String,

    medication: MedicationSchema,
    observationToolId: String,

    dueAt: { type: Date, required: true },
    timezone: String,

    recurrence: RecurrenceSchema,
    reminder: ReminderSchema,

    syncWithCalendar: Boolean,
    calendarEventId: String,

    attachments: [AttachmentSchema],

    status: {
      type: String,
      enum: ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
      default: "PENDING",
    },
    completedAt: Date,
    completedBy: String,
  },
  { timestamps: true },
);

TaskSchema.index({ assignedTo: 1, dueAt: 1 });
TaskSchema.index({ companionId: 1, dueAt: 1 });
TaskSchema.index({ organisationId: 1, dueAt: 1 });
TaskSchema.index({ "recurrence.masterTaskId": 1 });

export type TaskDocument = HydratedDocument<TaskMongo>;
export default model<TaskMongo>("Task", TaskSchema);
