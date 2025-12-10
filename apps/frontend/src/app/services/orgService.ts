import { getData, postData, putData } from "@/app/services/axios";
import { useOrgStore } from "@/app/stores/orgStore";
import {
  OrganizationRequestDTO,
  Organisation,
  toOrganizationResponseDTO,
  fromOrganizationRequestDTO,
  fromUserOrganizationRequestDTO,
  UserOrganization,
  UserOrganizationRequestDTO,
} from "@yosemite-crew/types";
import axios from "axios";
import { useAuthStore } from "../stores/authStore";

type MappingResponse = {
  mapping: UserOrganizationRequestDTO;
  organization: Organisation;
};

export const loadOrgs = async (opts?: { silent?: boolean }) => {
  const { startLoading, setOrgs, setError, setUserOrgMappings } =
    useOrgStore.getState();
  if (!opts?.silent) {
    startLoading();
  }
  try {
    const res = await getData<MappingResponse[]>(
      "/fhir/v1/user-organization/user/mapping"
    );
    const orgMappings: UserOrganization[] = [];
    const orgs: Organisation[] = [];
    for (const data of res.data) {
      const oM = fromUserOrganizationRequestDTO(data.mapping);
      orgMappings.push(oM);
      orgs.push(data.organization);
    }
    setOrgs(orgs, { keepPrimaryIfPresent: true });
    setUserOrgMappings(orgMappings);
  } catch (err: any) {
    if (!opts?.silent) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 403) {
          setError("You don't have permission to fetch organizations.");
        } else if (status === 404) {
          setError("Organization service not found. Please contact support.");
        } else {
          setError(
            err.response?.data?.message ??
              err.message ??
              "Failed to load organizations"
          );
        }
      } else {
        setError("Unexpected error while fetching organization");
      }
    }
    console.error("Failed to load orgs:", err);
    throw err;
  }
};

export const createOrg = async (formData: Organisation) => {
  const {
    startLoading,
    setError,
    upsertOrg,
    setPrimaryOrg,
    upsertUserOrgMapping,
  } = useOrgStore.getState();
  const { user, attributes } = useAuthStore.getState();
  const practitionerId = attributes?.sub || user?.getUsername() || "";
  startLoading();
  try {
    const fhirPayload = toOrganizationResponseDTO(formData);
    const res = await postData<OrganizationRequestDTO>(
      "/fhir/v1/organization",
      fhirPayload
    );
    const newOrg = fromOrganizationRequestDTO(res.data);
    const _id = newOrg._id?.toString() || newOrg.name;
    const newExtendedOrg = { ...newOrg, _id };
    upsertOrg(newExtendedOrg);
    setPrimaryOrg(_id);
    const ownerMapping: UserOrganization = {
      practitionerReference: practitionerId,
      organizationReference: _id,
      roleCode: "owner",
      roleDisplay: "Owner",
      active: false,
    };
    upsertUserOrgMapping(ownerMapping);
    console.log(newExtendedOrg);
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      if (status === 403) {
        setError("You don't have permission to create organizations.");
      } else if (status === 404) {
        setError("Organization service not found. Please contact support.");
      } else {
        setError(
          err.response?.data?.message ??
            err.message ??
            "Failed to load organizations"
        );
      }
    } else {
      setError("Unexpected error while creating organization");
    }
    console.error("Failed to load orgs:", err);
    throw err;
  }
};

export const updateOrg = async (formData: Organisation) => {
  const { startLoading, setError, updateOrg } =
    useOrgStore.getState();
  startLoading();
  try {
    const _id = formData._id?.toString()
    if (!_id) {
      setError("You don't have permission to update organizations.");
      return;
    }
    const fhirPayload = toOrganizationResponseDTO(formData);
    const res = await putData<OrganizationRequestDTO>(
      "/fhir/v1/organization/" + _id,
      fhirPayload
    );
    const newOrg = fromOrganizationRequestDTO(res.data);
    updateOrg(_id, newOrg);
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      if (status === 403) {
        setError("You don't have permission to update organizations.");
      } else if (status === 404) {
        setError("Organization service not found. Please contact support.");
      } else {
        setError(
          err.response?.data?.message ??
            err.message ??
            "Failed to load organizations"
        );
      }
    } else {
      setError("Unexpected error while updating organization");
    }
    console.error("Failed to load orgs:", err);
    throw err;
  }
};
