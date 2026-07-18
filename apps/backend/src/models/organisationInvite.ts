import type { OrganisationInvite } from "@yosemite-crew/types";

export type OrganisationInviteMongo = OrganisationInvite;

export type OrganisationInviteDocument = OrganisationInviteMongo & {
  _id: string;
};

export interface CreateOrganisationInviteInput {
  organisationId: string;
  invitedByUserId: string;
  departmentIds: string[];
  inviteeEmail: string;
  inviteeName?: string;
  role: string;
  employmentType?: OrganisationInvite["employmentType"];
}
