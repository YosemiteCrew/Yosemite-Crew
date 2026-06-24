import { deleteData, getData, patchData, postData, putData } from '@/app/services/axios';
import { useSpecialityStore } from '@/app/stores/specialityStore';
import { useOrgStore } from '@/app/stores/orgStore';
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
} from '@yosemite-crew/types';
import { SpecialityWithServices } from '@/app/features/organization/types/org';
import { useServiceStore } from '@/app/stores/serviceStore';
import { SpecialityWeb } from '@/app/features/organization/types/speciality';

const loadSpecialitiesPromisesByOrgId = new Map<string, Promise<void>>();

export const loadSpecialitiesForOrg = async (opts?: {
  silent?: boolean;
  force?: boolean;
  orgId?: string;
}): Promise<void> => {
  const {
    startLoading,
    status,
    setSpecialitiesForOrg,
    setError,
    specialityIdsByOrgId = {},
  } = useSpecialityStore.getState();
  const { setServicesForOrg } = useServiceStore.getState();
  const resolvedOrgId = opts?.orgId ?? useOrgStore.getState().primaryOrgId;
  if (!resolvedOrgId) {
    console.warn('No primary organization selected. Cannot load specialities.');
    return;
  }
  const hasOrgData = Object.hasOwn(specialityIdsByOrgId, resolvedOrgId);
  if (!shouldFetchSpecialities(status, hasOrgData, opts)) return;
  const existingPromise = loadSpecialitiesPromisesByOrgId.get(resolvedOrgId);
  if (existingPromise) {
    return existingPromise;
  }
  if (!opts?.silent) startLoading();
  const requestPromise = (async () => {
    try {
      const payload = await fetchSpecialities(resolvedOrgId);
      const { normalSpecialities, normalServices } = normalizeSpecialities(payload);

      setSpecialitiesForOrg(resolvedOrgId, normalSpecialities);
      setServicesForOrg(resolvedOrgId, normalServices);
    } catch (err) {
      setError('Failed to load specialities.');
      console.error('Failed to load specialities:', err);
      throw err;
    } finally {
      loadSpecialitiesPromisesByOrgId.delete(resolvedOrgId);
    }
  })();
  loadSpecialitiesPromisesByOrgId.set(resolvedOrgId, requestPromise);
  return requestPromise;
};

const fetchSpecialities = async (orgId: string): Promise<SpecialityWithServices[]> => {
  const res = await getData<SpecialityWithServices[]>(`/fhir/v1/speciality/organization/${orgId}`);
  const data = res.data as unknown;

  // If backend returns a FHIR Bundle (searchset), extract resources from entry[].resource
  if (
    data &&
    typeof data === 'object' &&
    (data as any).resourceType === 'Bundle' &&
    Array.isArray((data as any).entry)
  ) {
    try {
      const items: SpecialityWithServices[] = (data as any).entry
        .map((e: any) => e && (e.resource ?? e))
        .filter(Boolean)
        .map((raw: any) => {
          // If backend returned an Organization resource for a speciality, wrap it
          if (raw.resourceType === 'Organization') {
            return { speciality: raw, services: [] } as SpecialityWithServices;
          }

          // If the item already matches expected shape (has speciality), return as-is
          if (raw.speciality) return raw as SpecialityWithServices;

          // If the entry looks like a direct Speciality resource, wrap it
          if (
            raw.resourceType &&
            (raw.resourceType === 'Speciality' ||
              raw.resourceType === 'HealthcareService' ||
              raw.resourceType === 'Service')
          ) {
            return { speciality: raw, services: [] } as SpecialityWithServices;
          }

          // Unknown shape, return empty wrapper with raw in speciality to avoid downstream crashes
          return { speciality: raw, services: [] } as SpecialityWithServices;
        });

      return items;
    } catch (err) {
      console.warn('Failed to parse Bundle specialities response.', err, data);
      return [];
    }
  }

  if (!Array.isArray(data)) {
    console.warn('Specialities response is not an array.', data);
    return [];
  }

  return data as SpecialityWithServices[];
};

const shouldFetchSpecialities = (
  status: ReturnType<typeof useSpecialityStore.getState>['status'],
  hasOrgData: boolean,
  opts?: { force?: boolean }
) => {
  if (opts?.force) return true;
  if (!hasOrgData) return true;
  return status === 'idle' || status === 'error';
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

const addSpeciality = (bucket: SpecialityDTOAttributes[], item: SpecialityWithServices) => {
  const speciality = item.speciality;
  if (!speciality) {
    console.warn('Missing speciality in SpecialityWithServices item:', item);
    return;
  }
  bucket.push(fromSpecialityRequestDTO(speciality));
};

const addServices = (bucket: Service[], item: SpecialityWithServices) => {
  const services = item.services;
  if (services == null) return;
  if (!Array.isArray(services)) {
    console.warn('Services field is not an array in SpecialityWithServices item:', item);
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
    const res = await postData<SpecialityRequestDTO>('/fhir/v1/speciality', fhirSpeciality);
    const normalSpeciality = fromSpecialityRequestDTO(res.data);
    addSpeciality(normalSpeciality);
    return normalSpeciality;
  } catch (err) {
    console.error('Failed to create speciality:', err);
    throw err;
  }
};

const getBulkResponseItems = <T>(data: T[] | { created?: T[] }): T[] => {
  if (Array.isArray(data)) {
    return data;
  }
  return Array.isArray(data.created) ? data.created : [];
};

export const createSpecialitiesBulk = async (payload: Speciality[]) => {
  const { addSpeciality } = useSpecialityStore.getState();
  try {
    const fhirSpecialities = payload.map((speciality) => toSpecialityResponseDTO(speciality));
    const res = await postData<SpecialityRequestDTO[] | { created?: SpecialityRequestDTO[] }>(
      '/fhir/v1/speciality/bulk',
      fhirSpecialities
    );
    const normalSpecialities = getBulkResponseItems(res.data).map((speciality) =>
      fromSpecialityRequestDTO(speciality)
    );
    normalSpecialities.forEach(addSpeciality);
    return normalSpecialities;
  } catch (err) {
    console.error('Failed to create specialities:', err);
    throw err;
  }
};

export const createService = async (payload: Service) => {
  const { addService } = useServiceStore.getState();
  try {
    const fhirService = toServiceResponseDTO(payload);
    const res = await postData<ServiceRequestDTO>('/fhir/v1/service', fhirService);
    const normalService = fromServiceRequestDTO(res.data);
    addService(normalService);
  } catch (err) {
    console.error('Failed to create service:', err);
    throw err;
  }
};

export const createServicesBulk = async (payload: Service[]) => {
  const { addService } = useServiceStore.getState();
  try {
    const fhirServices = payload.map((service) => toServiceResponseDTO(service));
    const res = await postData<ServiceRequestDTO[] | { created?: ServiceRequestDTO[] }>(
      '/fhir/v1/service/bulk',
      fhirServices
    );
    const normalServices = getBulkResponseItems(res.data).map((service) =>
      fromServiceRequestDTO(service)
    );
    normalServices.forEach(addService);
    return normalServices;
  } catch (err) {
    console.error('Failed to create services:', err);
    throw err;
  }
};

export const createBulkSpecialityServices = async (payload: SpecialityWeb[]) => {
  try {
    const specialitiesToCreate = payload.filter(Boolean).map(
      (item): Speciality => ({
        ...item,
        services: [],
      })
    );
    const addedSpecialities = await createSpecialitiesBulk(specialitiesToCreate);
    const specialityIdByName = new Map(
      addedSpecialities.map((speciality) => [
        String(speciality.name ?? '')
          .trim()
          .toLowerCase(),
        speciality._id,
      ])
    );
    const servicesToCreate = payload.flatMap((item) => {
      if (!item) return [];
      const specialityId = specialityIdByName.get(
        String(item.name ?? '')
          .trim()
          .toLowerCase()
      );
      if (!specialityId) return [];
      return (item.services ?? []).map((service) => ({
        ...service,
        specialityId,
      }));
    });
    if (servicesToCreate.length > 0) {
      await createServicesBulk(servicesToCreate);
    }
  } catch (err) {
    console.error('Failed to create speciality:', err);
    throw err;
  }
};

export const updateSpeciality = async (payload: Speciality) => {
  const { updateSpeciality } = useSpecialityStore.getState();
  try {
    const fhirSpeciality = toSpecialityResponseDTO(payload);
    const res = await putData<SpecialityRequestDTO>(
      '/fhir/v1/speciality/' + payload._id,
      fhirSpeciality
    );
    const normalSpeciality = fromSpecialityRequestDTO(res.data);
    updateSpeciality(normalSpeciality);
    return normalSpeciality;
  } catch (err) {
    console.error('Failed to create speciality:', err);
    throw err;
  }
};

export const updateService = async (payload: Service) => {
  const { updateService } = useServiceStore.getState();
  try {
    const fhirService = toServiceResponseDTO(payload);
    const res = await patchData<ServiceRequestDTO>('/fhir/v1/service/' + payload.id, fhirService);
    const normalService = fromServiceRequestDTO(res.data);
    updateService(normalService);
  } catch (err) {
    console.error('Failed to create service:', err);
    throw err;
  }
};

export const deleteSpeciality = async (speciality: Speciality) => {
  const { deleteSpecialityById } = useSpecialityStore.getState();
  const { deleteServicesBySpecialityId } = useServiceStore.getState();
  try {
    const id = speciality._id;
    const orgId = speciality.organisationId;
    if (!id || !orgId) {
      throw new Error('Speciality ID or Organisation ID is missing.');
    }
    await deleteData('/fhir/v1/speciality/' + orgId + '/' + id);
    deleteSpecialityById(id);
    deleteServicesBySpecialityId(id);
  } catch (err) {
    console.error('Failed to delete speciality:', err);
    throw err;
  }
};
