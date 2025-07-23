import express from "express"
import  { inviteTeamsMembersController } from "../controllers/invite-teams-members"
import { verifyToken } from "../middlewares/authMiddleware"

const router = express.Router()
router.post('/invite',verifyToken,inviteTeamsMembersController.InviteTeamsMembers)
router.post('/invitedregister',inviteTeamsMembersController.invitedTeamMembersRegister)
router.get('/inviteInfo', inviteTeamsMembersController.inviteInfo)
router.get('/getinvites',verifyToken,inviteTeamsMembersController.getInvites)
router.delete('/removeInvites',verifyToken, inviteTeamsMembersController.removeInvites)
router.get('/practiceTeamOverView',inviteTeamsMembersController.practiceTeamOverView)
router.get('/practiceTeamsList', inviteTeamsMembersController.practiceTeamsList)

export default router