import { Schema, model, HydratedDocument } from "mongoose";

interface TaskCompletionMongo {
  taskId: string;
  companionId: string;
  filledBy: string;

  answers: Record<string, unknown>;
  score?: number;
  summary?: string;

  createdAt?: Date;
}

const TaskCompletionSchema = new Schema<TaskCompletionMongo>(
  {
    taskId: { type: String, required: true, index: true },
    companionId: { type: String, required: true },
    filledBy: { type: String, required: true },

    answers: { type: Schema.Types.Mixed, required: true },
    score: Number,
    summary: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type TaskCompletionDocument = HydratedDocument<TaskCompletionMongo>;
export default model<TaskCompletionMongo>(
  "TaskCompletion",
  TaskCompletionSchema,
);
