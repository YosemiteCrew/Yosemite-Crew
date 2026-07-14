import { SpecialityWeb } from '@/app/features/organization/types/speciality';
import { createOrg, updateOrg } from '@/app/features/organization/services/orgService';
import {
  createServicesBulk,
  createSpecialitiesBulk,
  updateService,
  deleteSpeciality,
} from '@/app/features/organization/services/specialityService';
import { deleteService } from '@/app/features/organization/services/serviceService';
import { bindPendingCompanionTerminologyToOrg } from '@/app/lib/companionTerminology';
import { resolveOrgScopedRedirect } from '@/app/lib/postAuthRedirect';
import {
  findOnboardingSpecialityTemplate,
  getResolvedBusinessType,
} from '@/app/lib/onboardingSpecialityCatalog';
import { Organisation, Service, Speciality } from '@yosemite-crew/types';
import type { Dispatch, SetStateAction } from 'react';

export const normalizeName = (value?: string | null) => (value ?? '').trim().toLowerCase();

export const getUniqueServiceNames = (services: Service[] = []) => {
  const seen = new Set<string>();
  return services.filter((service) => {
    const normalized = normalizeName(service.name);
    if (!normalized || seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    return true;
  });
};

export const getSpecialitySummary = (businessType: string, specialityName: string) =>
  findOnboardingSpecialityTemplate(getResolvedBusinessType(businessType), specialityName)
    ?.summary ??
  `A configurable specialty for ${specialityName.toLowerCase()} services in your organization.`;

export const filterWithoutService = (
  services: Service[],
  originalName: string | null
): Service[] => {
  if (originalName == null) return services;
  return services.filter((service) => normalizeName(service.name) !== normalizeName(originalName));
};

export const filterServicesByName = (services: Service[], serviceName: string): Service[] =>
  services.filter((service) => normalizeName(service.name) !== normalizeName(serviceName));

const buildServicePayload = (
  organisationId: string,
  specialityId: string,
  service: Service
): Service => ({
  ...service,
  id: '',
  isActive: true,
  organisationId,
  specialityId,
});

const areServicesEquivalent = (left: Service, right: Service) =>
  normalizeName(left.name) === normalizeName(right.name) &&
  Number(left.cost ?? 0) === Number(right.cost ?? 0) &&
  Number(left.durationMinutes ?? 0) === Number(right.durationMinutes ?? 0) &&
  Boolean(left.isActive ?? true) === Boolean(right.isActive ?? true);

const getServiceMatch = (services: Service[], candidate: Service) => {
  const candidateId = String(candidate.id ?? '').trim();
  if (candidateId) {
    const byId = services.find((service) => String(service.id ?? '').trim() === candidateId);
    if (byId) {
      return byId;
    }
  }

  return services.find((service) => normalizeName(service.name) === normalizeName(candidate.name));
};

export type SubmitSpecialityStepArgs = {
  formData: Organisation;
  initialSpecialities: SpecialityWeb[];
  isExistingOrg: boolean;
  organisationId: string;
  specialities: SpecialityWeb[];
  setFormData: Dispatch<SetStateAction<Organisation>>;
};

export type SubmitSpecialityStepResult = { nextRoute: string } | { errorMessage: string };

export const submitSpecialityStep = async ({
  formData,
  initialSpecialities,
  isExistingOrg,
  organisationId,
  specialities,
  setFormData,
}: SubmitSpecialityStepArgs): Promise<SubmitSpecialityStepResult> => {
  let resolvedOrgId = organisationId;
  if (isExistingOrg) {
    await updateOrg(formData);
  } else {
    resolvedOrgId = await createOrg(formData);
    setFormData((previous) => ({
      ...previous,
      _id: resolvedOrgId,
    }));
  }

  bindPendingCompanionTerminologyToOrg(resolvedOrgId);

  const nextSpecialities = specialities.map((speciality) => ({
    ...speciality,
    organisationId: speciality.organisationId || resolvedOrgId,
    services: getUniqueServiceNames(speciality.services ?? []).map((service) => ({
      ...service,
      organisationId: resolvedOrgId,
    })),
  }));

  const removedSpecialities = initialSpecialities.filter((initialSpeciality) => {
    const initialId = initialSpeciality._id?.toString();
    return !nextSpecialities.some((speciality) => {
      const specialityId = speciality._id?.toString();
      if (initialId && specialityId) {
        return initialId === specialityId;
      }
      return normalizeName(speciality.name) === normalizeName(initialSpeciality.name);
    });
  });

  const deleteResults = await Promise.allSettled(
    removedSpecialities.map((speciality) => deleteSpeciality(speciality as Speciality))
  );
  if (deleteResults.some((result) => result.status === 'rejected')) {
    return { errorMessage: 'We could not save your specialties. Please try again.' };
  }

  let createdSpecialities: Speciality[] = [];
  try {
    const specialitiesToCreate = nextSpecialities.reduce<Speciality[]>((items, speciality) => {
      if (speciality._id) return items;
      items.push({
        ...speciality,
        services: [],
      });
      return items;
    }, []);
    createdSpecialities =
      specialitiesToCreate.length > 0 ? await createSpecialitiesBulk(specialitiesToCreate) : [];
  } catch {
    return { errorMessage: 'We could not save your specialties. Please try again.' };
  }

  const specialityIdByName = new Map<string, string>();
  nextSpecialities.forEach((speciality) => {
    if (speciality._id) {
      specialityIdByName.set(normalizeName(speciality.name), speciality._id.toString());
    }
  });
  createdSpecialities.forEach((speciality) => {
    if (speciality._id) {
      specialityIdByName.set(normalizeName(speciality.name), speciality._id.toString());
    }
  });

  const initialServicesBySpecialityId = new Map<string, Service[]>();
  initialSpecialities.forEach((speciality) => {
    const specialityId = String(speciality._id ?? '').trim();
    if (!specialityId) {
      return;
    }
    initialServicesBySpecialityId.set(specialityId, speciality.services ?? []);
  });

  const servicesToCreate = nextSpecialities.flatMap((speciality) => {
    const specialityId = specialityIdByName.get(normalizeName(speciality.name));
    if (!specialityId) {
      return [];
    }

    const initialServices = initialServicesBySpecialityId.get(specialityId) ?? [];

    return (speciality.services ?? []).reduce<Service[]>((services, service) => {
      if (!getServiceMatch(initialServices, service)) {
        services.push(buildServicePayload(resolvedOrgId, specialityId, service));
      }
      return services;
    }, []);
  });

  const servicesToUpdate = nextSpecialities.flatMap((speciality) => {
    const specialityId = specialityIdByName.get(normalizeName(speciality.name));
    if (!specialityId) {
      return [];
    }

    const initialServices = initialServicesBySpecialityId.get(specialityId) ?? [];

    return (speciality.services ?? []).flatMap((service) => {
      const matchedService = getServiceMatch(initialServices, service);
      if (!matchedService || areServicesEquivalent(matchedService, service)) {
        return [];
      }

      return [
        {
          ...matchedService,
          ...service,
          id: matchedService.id,
          isActive: service.isActive ?? matchedService.isActive ?? true,
          organisationId: resolvedOrgId,
          specialityId,
        },
      ];
    });
  });

  const servicesToDelete = nextSpecialities.flatMap((speciality) => {
    const specialityId = specialityIdByName.get(normalizeName(speciality.name));
    if (!specialityId) {
      return [];
    }

    const initialServices = initialServicesBySpecialityId.get(specialityId) ?? [];
    const nextServices = speciality.services ?? [];

    return initialServices.filter(
      (initialService) => !getServiceMatch(nextServices, initialService)
    );
  });

  const serviceResults = await Promise.allSettled([
    ...servicesToDelete.map((service) => deleteService(service)),
    ...servicesToUpdate.map((service) => updateService(service)),
    ...(servicesToCreate.length > 0 ? [createServicesBulk(servicesToCreate)] : []),
  ]);
  if (serviceResults.some((result) => result.status === 'rejected')) {
    return { errorMessage: 'We could not save your services. Please try again.' };
  }

  const nextRoute = await resolveOrgScopedRedirect({
    orgId: resolvedOrgId,
    fallbackRole: 'owner',
  });
  return { nextRoute };
};
