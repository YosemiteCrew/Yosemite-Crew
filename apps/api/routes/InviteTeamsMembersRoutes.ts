import express from "express"
import  { inviteTeamsMembersController } from "../controllers/invite-teams-members"

const router = express.Router()
router.post('/invite',inviteTeamsMembersController.InviteTeamsMembers)
router.post('/invitedregister',inviteTeamsMembersController.invitedTeamMembersRegister)
router.get('/inviteInfo', inviteTeamsMembersController.inviteInfo)


export default router