import { getData, postData } from "@/app/services/axios";
import { useSpecialityStore } from "@/app/stores/specialityStore";
import { useOrgStore } from "../stores/orgStore";
import {
  fromSpecialityRequestDTO,
  Speciality,
  SpecialityRequestDTO,
  toSpecialityResponseDTO,
} from "@yosemite-crew/types";
import { SpecialityWithServices } from "../types/org";

export const loadSpecialitiesForOrg = async (): Promise<void> => {
  const { addSpeciality } = useSpecialityStore.getState();
  const primaryOrgId = useOrgStore.getState().primaryOrgId;

  if (!primaryOrgId) {
    console.warn("No primary organization selected. Cannot load specialities.");
    return;
  }

  try {
    const res = await getData<SpecialityWithServices[]>(
      `/fhir/v1/speciality/${primaryOrgId}`
    );
    for (const speciality of res.data) {
      const normalSpeciality = fromSpecialityRequestDTO(speciality.speciality);
      addSpeciality(normalSpeciality);
    }
  } catch (err) {
    console.error("Failed to load specialities:", err);
    throw err;
  }
};

export const createSpeciality = async (payload: Speciality) => {
  const { addSpeciality } = useSpecialityStore.getState();
  try {
    const fhirSpeciality = toSpecialityResponseDTO(payload);
    const res = await postData<SpecialityRequestDTO>(
      "/fhir/v1/speciality",
      fhirSpeciality
    );
    const normalSpeciality = fromSpecialityRequestDTO(res.data);
    addSpeciality(normalSpeciality);
  } catch (err) {
    console.error("Failed to create speciality:", err);
    throw err;
  }
};
