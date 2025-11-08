export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED';

export type OrganisationInvite = {
  _id?: string;
  organisationId: string;     // FK → Organisation
  invitedByUserId: string;    // FK → User (the admin who sent the invite)
  departmentId: string;       // FK → Department
  inviteeEmail: string;       // email to which invite was sent
  inviteeName?: string;       // optional: name entered during invite
  role: string;               // org role
  employmentType?: 'FULL_TIME' | 'PART_TIME' | 'CONTRACTOR';
  token: string;              // unique token to identify this invite
  status: InviteStatus;       // current state of invite
  expiresAt: Date;            // expiry timestamp (e.g., +7 days)
  acceptedAt?: Date;          // when invite was accepted
  createdAt?: Date;
  updatedAt?: Date;
};