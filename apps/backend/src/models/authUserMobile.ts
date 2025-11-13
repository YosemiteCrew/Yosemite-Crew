import { Schema, model, HydratedDocument, Types } from "mongoose";

export interface AuthUserMobile {
    authProvider: "cognito" | "firebase";
    providerUserId: string;
    email: string;
    parentId?: Types.ObjectId | null;
    createdAt?: Date;
    updatedAt?: Date;
}

const AuthUserMobileSchema = new Schema<AuthUserMobile>({
    authProvider: {
      type: String,
      enum: ["cognito", "firebase"],
      required: true
    },
    providerUserId: { type: String, required: true, index: true },
    email: { type: String, required: true, lowercase: true, index: true },
    parentId: { type: Schema.Types.ObjectId, ref: "Parent", default: null }
  }
)

export type AuthUserMobileDocumet = HydratedDocument<AuthUserMobile>

export const AuthUserMobileModel = model<AuthUserMobile>("AuthUser", AuthUserMobileSchema);