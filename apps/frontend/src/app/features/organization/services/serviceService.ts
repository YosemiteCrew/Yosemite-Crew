import axios from "axios";
import { deleteData, getData } from "@/app/services/axios";
import { useOrgStore } from "@/app/stores/orgStore";
import { useServiceStore } from "@/app/stores/serviceStore";
import {
  Service,
  ServiceRequestDTO,
  fromServiceRequestDTO,
} from "@yosemite-crew/types";

export const loadServicesForOrg = async (
  orgId?: string
): Promise<Service[]> => {
  const primaryOrgId = orgId ?? useOrgStore.getState().primaryOrgId;
  if (!primaryOrgId) {
    console.warn("No primary organisation selected. Skipping service fetch.");
    return [];
  }

  try {
    const res = await getData<ServiceRequestDTO[]>(
      `/fhir/v1/service/organisation/${primaryOrgId}`
    );
    if (!Array.isArray(res.data)) {
      console.warn("Services response is not an array.", res.data);
      return [];
    }
    const services = res.data.map(fromServiceRequestDTO);
    useServiceStore.getState().setServices(services);
    return services;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      console.error(
        "Failed to load services:",
        err.response?.data?.message ?? err.message
      );
    } else {
      console.error("Failed to load services:", err);
    }
    return [];
  }
};

export const deleteService = async (service: Service) => {
  const { deleteServiceById } = useServiceStore.getState();
  try {
    const id = service.id;
    if (!id) {
      throw new Error("Service ID is missing.");
    }
    await deleteData("/fhir/v1/service/" + id);
    deleteServiceById(id);
  } catch (err) {
    console.error("Failed to delete service:", err);
    throw err;
  }
};
