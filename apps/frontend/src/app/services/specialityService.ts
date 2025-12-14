import { getData, patchData, postData, putData } from "@/app/services/axios";
import { useSpecialityStore } from "@/app/stores/specialityStore";
import { useOrgStore } from "../stores/orgStore";
import {
  fromServiceRequestDTO,
  fromSpecialityRequestDTO,
  Service,
  ServiceRequestDTO,
  Speciality,
  SpecialityDTOAttributes,
  SpecialityRequestDTO,
  toServiceResponseDTO,
  toSpecialityResponseDTO,
} from "@yosemite-crew/types";
import { SpecialityWithServices } from "../types/org";
import { useServiceStore } from "../stores/serviceStore";
import { SpecialityWeb } from "../types/speciality";

export const loadSpecialitiesForOrg = async (opts?: {
  silent?: boolean;
  force?: boolean;
}): Promise<void> => {
  const { startLoading, status, setSpecialitiesForOrg } =
    useSpecialityStore.getState();
  const { setServicesForOrg } = useServiceStore.getState();
  const primaryOrgId = useOrgStore.getState().primaryOrgId;
  if (!primaryOrgId) {
    console.warn("No primary organization selected. Cannot load specialities.");
    return;
  }
  if (!shouldFetchSpecialities(status, opts)) return;
  if (!opts?.silent) startLoading();
  try {
    const payload = await fetchSpecialities(primaryOrgId);
    const { normalSpecialities, normalServices } =
      normalizeSpecialities(payload);

    setSpecialitiesForOrg(primaryOrgId, normalSpecialities);
    setServicesForOrg(primaryOrgId, normalServices);
  } catch (err) {
    console.error("Failed to load specialities:", err);
    throw err;
  }
};

const fetchSpecialities = async (
  orgId: string
): Promise<SpecialityWithServices[]> => {
  const res = await getData<SpecialityWithServices[]>(
    `/fhir/v1/speciality/${orgId}`
  );
  if (!Array.isArray(res.data)) {
    console.warn("Specialities response is not an array.", res.data);
    return [];
  }
  return res.data;
};

const shouldFetchSpecialities = (
  status: ReturnType<typeof useSpecialityStore.getState>["status"],
  opts?: { force?: boolean }
) => {
  if (opts?.force) return true;
  return status === "idle" || status === "error";
};

const normalizeSpecialities = (items: SpecialityWithServices[]) => {
  const normalSpecialities: SpecialityDTOAttributes[] = [];
  const normalServices: Service[] = [];

  for (const item of items) {
    if (!item) continue;
    addSpeciality(normalSpecialities, item);
    addServices(normalServices, item);
  }

  return { normalSpecialities, normalServices };
};

const addSpeciality = (
  bucket: SpecialityDTOAttributes[],
  item: SpecialityWithServices
) => {
  const speciality = item.speciality;
  if (!speciality) {
    console.warn("Missing speciality in SpecialityWithServices item:", item);
    return;
  }
  bucket.push(fromSpecialityRequestDTO(speciality));
};

const addServices = (bucket: Service[], item: SpecialityWithServices) => {
  const services = item.services;
  if (services == null) return;
  if (!Array.isArray(services)) {
    console.warn(
      "Services field is not an array in SpecialityWithServices item:",
      item
    );
    return;
  }

  for (const serviceDTO of services) {
    if (!serviceDTO) continue;
    bucket.push(fromServiceRequestDTO(serviceDTO));
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
    return normalSpeciality;
  } catch (err) {
    console.error("Failed to create speciality:", err);
    throw err;
  }
};

export const createService = async (payload: Service) => {
  const { addService } = useServiceStore.getState();
  try {
    const fhirService = toServiceResponseDTO(payload);
    const res = await postData<ServiceRequestDTO>(
      "/fhir/v1/service",
      fhirService
    );
    const normalService = fromServiceRequestDTO(res.data);
    addService(normalService);
  } catch (err) {
    console.error("Failed to create service:", err);
    throw err;
  }
};

export const createBulkSpecialityServices = async (
  payload: SpecialityWeb[]
) => {
  try {
    for (const item of payload) {
      if (!item) continue;
      const speciaity: Speciality = {
        ...item,
        services: [],
      };
      const addedSpeciality = await createSpeciality(speciaity);
      const services = item.services || [];
      await Promise.allSettled(
        services.map((s) =>
          createService({
            ...s,
            specialityId: addedSpeciality._id,
          })
        )
      );
    }
  } catch (err) {
    console.error("Failed to create speciality:", err);
    throw err;
  }
};

export const updateSpeciality = async (payload: Speciality) => {
  const { updateSpeciality } = useSpecialityStore.getState();
  try {
    const fhirSpeciality = toSpecialityResponseDTO(payload);
    const res = await putData<SpecialityRequestDTO>(
      "/fhir/v1/speciality/" + payload._id,
      fhirSpeciality
    );
    const normalSpeciality = fromSpecialityRequestDTO(res.data);
    updateSpeciality(normalSpeciality);
    return normalSpeciality;
  } catch (err) {
    console.error("Failed to create speciality:", err);
    throw err;
  }
};

export const updateService = async (payload: Service) => {
  const { updateService } = useServiceStore.getState();
  try {
    const fhirService = toServiceResponseDTO(payload);
    const res = await patchData<ServiceRequestDTO>(
      "/fhir/v1/service/" + payload.id,
      fhirService
    );
    const normalService = fromServiceRequestDTO(res.data);
    updateService(normalService);
  } catch (err) {
    console.error("Failed to create service:", err);
    throw err;
  }
};
