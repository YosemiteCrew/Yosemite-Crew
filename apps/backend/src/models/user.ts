import { Schema, model, type HydratedDocument } from 'mongoose'

export interface UserMongo {
    userId: string
    email: string
    isActive: boolean
}

const UserSchema = new Schema<UserMongo>(
    {
        userId: { type: String, required: true, unique: true, trim: true },
        email: { type: String, required: true, unique: true, trim: true, lowercase: true },
        isActive: { type: Boolean, default: true },
    },
    {
        timestamps: true,
    }
)

export type UserDocument = HydratedDocument<UserMongo>

const UserModel = model<UserMongo>('User', UserSchema)

export default UserModel
