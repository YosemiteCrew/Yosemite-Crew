import { Document } from "mongoose";

export interface IRole extends Document {
  name: string;
  description?: string;
  permissions: Record<string, string[]>; // e.g. { posts: ["view", "edit"] }
}