export type TeamInviteMember = {
  department: string;
  role: string;
  email: string;
  invitedBy: string; 
  invitedAt?: Date;
  inviteCode?: string; // Optional, can be generated later
};
export interface InvitePayload {
  email: string;
  role: string;
  department: string;
  invitedBy: string;
};