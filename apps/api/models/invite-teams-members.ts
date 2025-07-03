import { TeamInviteMember } from "@yosemite-crew/types"
import {Schema, model} from "mongoose"

const inviteTeamsMembersSchema = new Schema<TeamInviteMember>({
    email:{type:String},
    department:{type:String},
    role:{type:String},
    invitedBy:{type:String},
    invitedAt: { type: Date, default: Date.now },
    inviteCode: { type: String, required: true, unique: true }

})

export const inviteTeamsMembers = model<TeamInviteMember>('InviteTeamsMembers', inviteTeamsMembersSchema)