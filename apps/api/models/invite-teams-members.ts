import { TeamInviteMember } from "@yosemite-crew/types"
import {Schema, model} from "mongoose"

const inviteTeamsMembersSchema = new Schema<TeamInviteMember>({
    bussinessId:{type:String},
    name:{type:String},
    email:{type:String},
    department:{type:String},
    role:{type:String},
    invitedBy:{type:String},
    invitedAt: { type: Date, default: Date.now },
    inviteCode: { type: String, required: true, unique: true },
    status: { type: String, enum: ["pending", "accepted", "declined"], default: "pending" },

})

export const inviteTeamsMembers = model<TeamInviteMember>('InviteTeamsMembers', inviteTeamsMembersSchema)