import {
  fromUserOrganizationRequestDTO,
  toUserOrganizationResponseDTO,
  UserOrganization,
} from "@yosemite-crew/types";
import { useOrgStore } from "../stores/orgStore";
import { useTeamStore } from "../stores/teamStore";
import { Invite, Team, TeamFormDataType, TeamResponse } from "../types/team";
import { deleteData, getData, postData, putData } from "./axios";
import { loadOrgs } from "./orgService";
import { loadProfiles } from "./profileService";
import { PractitionerRole } from "@yosemite-crew/fhirtypes";
import { toPermissionArray } from "../utils/permissions";

export const loadTeam = async (opts?: {
  silent?: boolean;
  force?: boolean;
}) => {
  const { startLoading, status, setTeamsForOrg } = useTeamStore.getState();
  const primaryOrgId = useOrgStore.getState().primaryOrgId;
  if (!primaryOrgId) {
    console.warn("No primary organization selected. Cannot send invite.");
    return [];
  }
  if (!shouldFetchTeam(status, opts)) return;
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
      if (!oM.id) {
        continue;
      }
      const teamObject: Team = {
        _id: oM.id,
        practionerId: oM.practitionerReference,
        organisationId: oM.organizationReference,
        name: data.name,
        image: data.profileUrl,
        role: oM.roleCode,
        speciality: data.speciality,
        todayAppointment: data.count,
        weeklyWorkingHours: data.weeklyHours,
        status: data.currentStatus,
        effectivePermissions: toPermissionArray(oM.effectivePermissions),
        extraPerissions: toPermissionArray(oM.extraPermissions),
      };
      temp.push(teamObject);
    }
    setTeamsForOrg(primaryOrgId, temp);
  } catch (err: any) {
    console.error("Failed to load invites:", err);
    throw err;
  }
};

const shouldFetchTeam = (
  status: ReturnType<typeof useTeamStore.getState>["status"],
  opts?: { force?: boolean }
) => {
  if (opts?.force) return true;
  return status === "idle" || status === "error";
};

export const sendInvite = async (invite: TeamFormDataType) => {
  const primaryOrgId = useOrgStore.getState().primaryOrgId;
  if (!primaryOrgId) {
    console.warn("No primary organization selected. Cannot send invite.");
    throw new Error("No primary organization selected");
  }
  try {
    const body = {
      departmentIds: invite.speciality,
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
  try {
    await postData<Invite[]>(
      "/fhir/v1/organisation-invites/" + invite.token + "/accept"
    );
    await loadOrgs({ silent: true });
    await loadProfiles({ silent: true });
    await loadTeam({ silent: true });
    setPrimaryOrg(invite.organisationId);
  } catch (error) {
    console.log(error);
  }
};

export const rejectInvite = async (invite: Invite) => {
  try {
    console.log(invite._id);
  } catch (error) {
    console.log(error);
  }
};

export const getProfileForUserForPrimaryOrg = async (userId: string) => {
  const { primaryOrgId } = useOrgStore.getState();
  if (!primaryOrgId) {
    console.warn("No primary organization selected. Cannot load companions.");
    return [];
  }
  try {
    if (!userId) {
      return [];
    }
    const res = await getData(
      "/fhir/v1/user-profile/" + userId + "/" + primaryOrgId + "/profile"
    );
    const data = res.data;
    return data;
  } catch (err) {
    console.error("Failed to create service:", err);
    throw err;
  }
};

export const removeMember = async (member: Team) => {
  const { removeTeam } = useTeamStore.getState();
  try {
    const id = member._id;
    if (!id) {
      throw new Error("Member ID is missing.");
    }
    await deleteData("/fhir/v1/user-organization/" + id);
    removeTeam(id);
  } catch (err) {
    console.error("Failed to delete room:", err);
    throw err;
  }
};

export const updateMember = async (member: Team) => {
  const { updateTeam } = useTeamStore.getState();
  const { primaryOrgId } = useOrgStore.getState();
  if (!primaryOrgId) {
    console.warn("No primary organization selected. Cannot load companions.");
    return;
  }
  try {
    const fhirPayload: UserOrganization = {
      practitionerReference: member.practionerId,
      organizationReference: member.organisationId,
      roleCode: member.role,
      roleDisplay: member.role,
      effectivePermissions: member.effectivePermissions,
      extraPermissions: member.extraPerissions,
    };
    const fhirMapping = toUserOrganizationResponseDTO(fhirPayload);
    const res = await putData<PractitionerRole>(
      "/fhir/v1/user-organization/" + member._id,
      fhirMapping
    );
    const normalTeam = fromUserOrganizationRequestDTO(res.data);
    const teamObject: Team = {
      ...member,
      role: normalTeam.roleCode,
      effectivePermissions: toPermissionArray(normalTeam.effectivePermissions),
      extraPerissions: toPermissionArray(normalTeam.extraPermissions),
    };
    updateTeam(teamObject);
  } catch (err) {
    console.error("Failed to create service:", err);
    throw err;
  }
};
