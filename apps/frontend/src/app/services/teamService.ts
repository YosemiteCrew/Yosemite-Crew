import { fromUserOrganizationRequestDTO } from "@yosemite-crew/types";
import { useOrgStore } from "../stores/orgStore";
import { useTeamStore } from "../stores/teamStore";
import { Invite, Team, TeamFormDataType, TeamResponse } from "../types/team";
import { getData, postData } from "./axios";
import { loadOrgs } from "./orgService";
import { loadProfiles } from "./profileService";

export const loadTeam = async (opts?: { silent?: boolean }) => {
  const { setTeams, startLoading } = useTeamStore.getState();
  const primaryOrgId = useOrgStore.getState().primaryOrgId;
  if (!primaryOrgId) {
    console.warn("No primary organization selected. Cannot send invite.");
    return [];
  }
  if (!opts?.silent) {
    startLoading();
  }
  try {
    const res = await getData<TeamResponse[]>(
      "/fhir/v1/user-organization/org/mapping/" + primaryOrgId
    );
    const temp: Team[] = [];
    for (const data of res.data) {
      const oM = fromUserOrganizationRequestDTO(data.userOrganisation);
      const teamObject: Team = {
        _id: oM.practitionerReference,
        organisationId: oM.organizationReference,
        name: data.name,
        image: data.profileUrl,
        role: oM.roleCode,
        speciality: data.speciality,
        todayAppointment: data.count,
        weeklyWorkingHours: data.weeklyHours,
        status: data.currentStatus,
      };
      temp.push(teamObject);
    }
    setTeams(temp);
  } catch (err: any) {
    console.error("Failed to load invites:", err);
    throw err;
  }
};

export const sendInvite = async (invite: TeamFormDataType) => {
  const primaryOrgId = useOrgStore.getState().primaryOrgId;
  if (!primaryOrgId) {
    console.warn("No primary organization selected. Cannot send invite.");
    throw new Error("No primary organization selected");
  }
  try {
    const body = {
      departmentId: invite.speciality.key,
      inviteeEmail: invite.email,
      role: invite.role,
      employmentType: invite.type,
    };
    await postData("/fhir/v1/organization/" + primaryOrgId + "/invites", body);
  } catch (err: any) {
    console.error("Failed to add team:", err);
    throw err;
  }
};

export const loadInvites = async () => {
  try {
    const res = await getData("/fhir/v1/organisation-invites/me/pending");
    const invites: Invite[] = [];
    for (const invite of res.data as any) {
      invites.push({ ...invite.invite, ...invite });
    }
    return invites;
  } catch (err: any) {
    console.error("Failed to load invites:", err);
    throw err;
  }
};

export const acceptInvite = async (invite: Invite) => {
  const { setPrimaryOrg } = useOrgStore.getState();
  await postData<Invite[]>(
    "/fhir/v1/organisation-invites/" + invite.token + "/accept"
  );
  await loadOrgs({ silent: true });
  await loadProfiles({ silent: true });
  await loadTeam({ silent: true });
  setPrimaryOrg(invite.organisationId);
};
