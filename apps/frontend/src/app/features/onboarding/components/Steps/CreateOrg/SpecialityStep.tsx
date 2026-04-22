import React, { useEffect, useMemo, useRef, useState } from 'react';
import { IoAdd, IoPencil, IoSearch } from 'react-icons/io5';
import { MdDeleteForever } from 'react-icons/md';
import { useRouter } from 'next/navigation';
import axios from 'axios';

import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import { useCurrencyForPrimaryOrg } from '@/app/hooks/useBilling';
import { SpecialityWeb } from '@/app/features/organization/types/speciality';
import { createOrg, updateOrg } from '@/app/features/organization/services/orgService';
import {
  createService,
  createSpeciality,
  updateService,
  deleteSpeciality,
  loadSpecialitiesForOrg,
} from '@/app/features/organization/services/specialityService';
import { deleteService } from '@/app/features/organization/services/serviceService';
import { bindPendingCompanionTerminologyToOrg } from '@/app/lib/companionTerminology';
import {
  buildCustomOnboardingServiceTemplate,
  buildOnboardingServiceDraft,
  buildOnboardingServiceDrafts,
  findOnboardingSpecialityTemplate,
  getOnboardingSpecialityCatalog,
  getOrgTypeSpecialityContent,
  getRecommendedOnboardingSpecialities,
  getResolvedBusinessType,
  OnboardingServiceTemplate,
} from '@/app/lib/onboardingSpecialityCatalog';
import { Organisation, Service, Speciality } from '@yosemite-crew/types';

import './Step.css';

type SpecialityStepProps = {
  formData: Organisation;
  initialSpecialities: SpecialityWeb[];
  isExistingOrg: boolean;
  prevStep: () => void;
  specialities: SpecialityWeb[];
  setFormData: React.Dispatch<React.SetStateAction<Organisation>>;
  setSpecialities: React.Dispatch<React.SetStateAction<SpecialityWeb[]>>;
};

type ServiceEditorState = {
  originalName: string | null;
  service: Service;
  specialityName: string;
};

const normalizeName = (value?: string | null) => (value ?? '').trim().toLowerCase();

const getUniqueServiceNames = (services: Service[] = []) => {
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

const getSpecialitySummary = (businessType: string, specialityName: string) =>
  findOnboardingSpecialityTemplate(getResolvedBusinessType(businessType), specialityName)
    ?.summary ??
  `A configurable specialty for ${specialityName.toLowerCase()} services in your organization.`;

const filterWithoutService = (services: Service[], originalName: string | null): Service[] => {
  if (originalName == null) return services;
  return services.filter((service) => normalizeName(service.name) !== normalizeName(originalName));
};

const filterServicesByName = (services: Service[], serviceName: string): Service[] =>
  services.filter((service) => normalizeName(service.name) !== normalizeName(serviceName));

const buildServicePayload = (
  organisationId: string,
  specialityId: string,
  service: Service
): Service =>
  ({
    ...service,
    id: '',
    isActive: true,
    organisationId,
    specialityId,
  }) as Service;

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

const SpecialityStep = ({
  formData,
  initialSpecialities,
  isExistingOrg,
  prevStep,
  specialities,
  setFormData,
  setSpecialities,
}: SpecialityStepProps) => {
  const router = useRouter();
  const [activeServiceSearchFor, setActiveServiceSearchFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [isSpecialityPickerOpen, setIsSpecialityPickerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serviceEditor, setServiceEditor] = useState<ServiceEditorState | null>(null);
  const [serviceQueries, setServiceQueries] = useState<Record<string, string>>({});
  const [specialityQuery, setSpecialityQuery] = useState('');

  const specialityPickerRef = useRef<HTMLDivElement>(null);
  const servicePickerRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const businessType = getResolvedBusinessType(formData.type);
  const currency = useCurrencyForPrimaryOrg();
  const orgTypeContent = getOrgTypeSpecialityContent(businessType);
  const organisationId = formData._id?.toString() ?? '';

  const selectedNames = useMemo(
    () => new Set(specialities.map((speciality) => normalizeName(speciality.name))),
    [specialities]
  );

  const catalog = useMemo(() => getOnboardingSpecialityCatalog(businessType), [businessType]);
  const recommendedSpecialities = useMemo(
    () => getRecommendedOnboardingSpecialities(businessType).slice(0, 6),
    [businessType]
  );

  const filteredCatalog = useMemo(() => {
    const normalizedQuery = normalizeName(specialityQuery);
    return catalog.filter((item) => {
      if (selectedNames.has(normalizeName(item.name))) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      return (
        normalizeName(item.name).includes(normalizedQuery) ||
        item.services.some((service) => normalizeName(service.name).includes(normalizedQuery))
      );
    });
  }, [catalog, selectedNames, specialityQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        specialityPickerRef.current &&
        !specialityPickerRef.current.contains(event.target as Node)
      ) {
        setIsSpecialityPickerOpen(false);
      }

      if (!activeServiceSearchFor) {
        return;
      }

      const activeServicePicker = servicePickerRefs.current[activeServiceSearchFor];
      if (activeServicePicker && !activeServicePicker.contains(event.target as Node)) {
        setActiveServiceSearchFor(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeServiceSearchFor]);

  const updateSpecialities = (updater: (previous: SpecialityWeb[]) => SpecialityWeb[]) => {
    setSpecialities((previous) => updater(previous));
    setError(null);
  };

  const openServiceEditor = (
    specialityName: string,
    service: Service,
    originalName?: string | null
  ) => {
    setServiceEditor({
      originalName: originalName ?? service.name,
      service,
      specialityName,
    });
    setIsServiceModalOpen(true);
  };

  const closeServiceEditor = () => {
    setIsServiceModalOpen(false);
    setServiceEditor(null);
  };

  const addSpeciality = (specialityName: string, services: Service[]) => {
    updateSpecialities((previous) => {
      if (previous.some((item) => normalizeName(item.name) === normalizeName(specialityName))) {
        return previous;
      }

      return [
        ...previous,
        {
          name: specialityName,
          organisationId,
          services: getUniqueServiceNames(services),
        },
      ];
    });

    setSpecialityQuery('');
    setIsSpecialityPickerOpen(false);
  };

  const handleSelectSpeciality = (specialityName: string) => {
    const serviceDrafts = buildOnboardingServiceDrafts(
      specialityName,
      findOnboardingSpecialityTemplate(businessType, specialityName)?.services.map(
        (service) => service.name
      ) ?? [],
      businessType,
      organisationId
    );

    addSpeciality(specialityName, serviceDrafts);
  };

  const handleAddCustomSpeciality = () => {
    const trimmedQuery = specialityQuery.trim();
    if (!trimmedQuery) {
      return;
    }
    addSpeciality(trimmedQuery, []);
  };

  const handleRemoveSpeciality = (specialityName: string) => {
    updateSpecialities((previous) =>
      previous.filter((item) => normalizeName(item.name) !== normalizeName(specialityName))
    );
    if (
      activeServiceSearchFor &&
      normalizeName(activeServiceSearchFor) === normalizeName(specialityName)
    ) {
      setActiveServiceSearchFor(null);
    }
  };

  const getAvailableServicesForSpeciality = (specialityName: string, query: string) => {
    const currentSpeciality = specialities.find(
      (item) => normalizeName(item.name) === normalizeName(specialityName)
    );
    const selectedServiceNames = new Set(
      (currentSpeciality?.services ?? []).map((service) => normalizeName(service.name))
    );
    const normalizedQuery = normalizeName(query);
    const templateServices =
      findOnboardingSpecialityTemplate(businessType, specialityName)?.services ?? [];

    return templateServices.filter((service) => {
      const normalizedServiceName = normalizeName(service.name);
      if (selectedServiceNames.has(normalizedServiceName)) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      return normalizedServiceName.includes(normalizedQuery);
    });
  };

  const startServiceCreation = (
    specialityName: string,
    serviceTemplate: OnboardingServiceTemplate
  ) => {
    openServiceEditor(
      specialityName,
      buildOnboardingServiceDraft(serviceTemplate, organisationId),
      null
    );
    setActiveServiceSearchFor(null);
    setServiceQueries((previous) => ({ ...previous, [specialityName]: '' }));
  };

  const handleCreateCustomService = (specialityName: string) => {
    const serviceName = serviceQueries[specialityName]?.trim();
    if (!serviceName) {
      return;
    }

    startServiceCreation(
      specialityName,
      buildCustomOnboardingServiceTemplate(specialityName, serviceName, businessType)
    );
  };

  const handleSaveService = () => {
    if (!serviceEditor) {
      return;
    }

    const trimmedServiceName = serviceEditor.service.name.trim();
    if (!trimmedServiceName) {
      setError('Service name is required.');
      return;
    }

    updateSpecialities((previous) =>
      previous.map((speciality) => {
        if (normalizeName(speciality.name) !== normalizeName(serviceEditor.specialityName)) {
          return speciality;
        }

        const nextService = {
          ...serviceEditor.service,
          name: trimmedServiceName,
        };

        const existingServices = speciality.services ?? [];
        const withoutOriginal = filterWithoutService(existingServices, serviceEditor.originalName);

        return {
          ...speciality,
          services: getUniqueServiceNames([...withoutOriginal, nextService]),
        };
      })
    );

    closeServiceEditor();
  };

  const handleRemoveService = (specialityName: string, serviceName: string) => {
    updateSpecialities((previous) =>
      previous.map((speciality) => {
        if (normalizeName(speciality.name) !== normalizeName(specialityName)) {
          return speciality;
        }

        return {
          ...speciality,
          services: filterServicesByName(speciality.services ?? [], serviceName),
        };
      })
    );
  };

  const handleServiceNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setServiceEditor((previous) =>
      previous == null
        ? previous
        : { ...previous, service: { ...previous.service, name: event.target.value } }
    );
  };

  const handleServiceDurationChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setServiceEditor((previous) =>
      previous == null
        ? previous
        : {
            ...previous,
            service: { ...previous.service, durationMinutes: Number(event.target.value || 0) },
          }
    );
  };

  const handleServiceCostChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setServiceEditor((previous) =>
      previous == null
        ? previous
        : { ...previous, service: { ...previous.service, cost: Number(event.target.value || 0) } }
    );
  };

  const handleSubmit = async () => {
    if (specialities.length === 0) {
      setError('Add at least one specialty to continue');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

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
        setError('We could not save your specialties. Please try again.');
        setIsSubmitting(false);
        return;
      }

      const createdSpecialityResults = await Promise.allSettled(
        nextSpecialities
          .filter((speciality) => !speciality._id)
          .map((speciality) =>
            createSpeciality({
              ...speciality,
              services: [],
            })
          )
      );

      if (createdSpecialityResults.some((result) => result.status === 'rejected')) {
        setError('We could not save your specialties. Please try again.');
        setIsSubmitting(false);
        return;
      }

      const specialityIdByName = new Map<string, string>();
      nextSpecialities.forEach((speciality) => {
        if (speciality._id) {
          specialityIdByName.set(normalizeName(speciality.name), speciality._id.toString());
        }
      });
      createdSpecialityResults.forEach((result) => {
        if (result.status === 'fulfilled' && result.value?._id) {
          specialityIdByName.set(normalizeName(result.value.name), result.value._id.toString());
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

        return (speciality.services ?? [])
          .filter((service) => !getServiceMatch(initialServices, service))
          .map((service) => buildServicePayload(resolvedOrgId, specialityId, service));
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
            } as Service,
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
        ...servicesToCreate.map((service) => createService(service)),
      ]);
      if (serviceResults.some((result) => result.status === 'rejected')) {
        setError('We could not save your services. Please try again.');
        setIsSubmitting(false);
        return;
      }

      await loadSpecialitiesForOrg({ force: true, silent: true });
      router.push('/dashboard');
    } catch (submissionError) {
      console.error('Failed to save specialties:', submissionError);
      const message = axios.isAxiosError(submissionError)
        ? (submissionError.response?.data?.message ?? submissionError.message)
        : 'We could not save your specialties. Please try again.';
      setError(message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="step-container">
      <div className="step-three-shell">
        <div className="step-three-overview">
          <div className="step-title">Specialties and services</div>
          <div className="step-three-overview-copy">
            Add the specialties you offer, then fine-tune service duration and pricing for each one.
          </div>
        </div>

        <div className="step-three-search-panel">
          <div className="step-three-search-label">Search or add a specialty</div>
          <div className="step-three-search-copy">{orgTypeContent.audience}</div>
          <div className="step-three-picker-host" ref={specialityPickerRef}>
            <div className="step-three-speciality-picker">
              <IoSearch className="step-three-search-icon" size={18} />
              <input
                className="step-three-speciality-input"
                name="speciality-search"
                placeholder="Search specialties or create a custom one"
                value={specialityQuery}
                onChange={(event) => {
                  setSpecialityQuery(event.target.value);
                  setIsSpecialityPickerOpen(true);
                }}
                onFocus={() => setIsSpecialityPickerOpen(true)}
              />
            </div>
            {isSpecialityPickerOpen ? (
              <div className="step-three-picker-dropdown step-three-picker-dropdown--overlay">
                {filteredCatalog.length > 0 ? (
                  filteredCatalog.slice(0, 8).map((item) => (
                    <button
                      key={item.name}
                      className="step-three-picker-option"
                      onClick={() => handleSelectSpeciality(item.name)}
                    >
                      <div className="step-three-picker-option-title">{item.name}</div>
                      <div className="step-three-picker-option-copy">
                        {item.services.length} starter services included
                      </div>
                    </button>
                  ))
                ) : (
                  <button
                    type="button"
                    className="step-three-picker-option step-three-picker-option--empty"
                    onClick={handleAddCustomSpeciality}
                  >
                    Create specialty “{specialityQuery.trim()}”
                  </button>
                )}
              </div>
            ) : null}
          </div>

          <div className="step-three-recommended-row">
            <span className="step-three-recommended-label">{orgTypeContent.title}</span>
            <div className="step-three-chip-group">
              {recommendedSpecialities.map((item, itemIndex) => {
                const isSelected = selectedNames.has(normalizeName(item.name));
                return (
                  <button
                    key={`${item.name}-${itemIndex}`}
                    className="step-three-recommendation-chip"
                    disabled={isSelected}
                    onClick={() => handleSelectSpeciality(item.name)}
                  >
                    {item.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {specialities.length === 0 ? (
          <div className="step-three-empty-state">
            <div className="step-three-empty-title">No specialties added yet</div>
            <div className="step-three-empty-copy">
              Start with a recommended specialty or search above to add your own.
            </div>
          </div>
        ) : (
          <div className="step-three-selected-grid">
            {specialities.map((speciality) => {
              const serviceQuery = serviceQueries[speciality.name] ?? '';
              const availableServices = getAvailableServicesForSpeciality(
                speciality.name,
                serviceQuery
              );
              const summary = getSpecialitySummary(businessType, speciality.name);
              const isServiceSearchOpen =
                activeServiceSearchFor != null &&
                normalizeName(activeServiceSearchFor) === normalizeName(speciality.name);

              return (
                <div className="step-three-selected-card" key={speciality.name}>
                  <div className="step-three-selected-card-header">
                    <div className="step-three-selected-card-copy">
                      <div className="step-three-card-title-row">
                        <div className="step-three-card-title">{speciality.name}</div>
                        <div className="step-three-card-badge">
                          {(speciality.services ?? []).length} services
                        </div>
                      </div>
                      <div className="step-three-card-copy">{summary}</div>
                    </div>
                    <button
                      className="step-three-remove-button"
                      aria-label={`Delete ${speciality.name}`}
                      onClick={() => handleRemoveSpeciality(speciality.name)}
                    >
                      <MdDeleteForever size={18} />
                    </button>
                  </div>

                  <div className="step-three-service-list">
                    {(speciality.services ?? []).map((service, serviceIndex) => (
                      <div
                        className="step-three-service-card"
                        key={`${speciality.name}-${service.name}-${serviceIndex}`}
                      >
                        <div className="step-three-service-card-main">
                          <div className="step-three-service-card-header">
                            <div className="step-three-service-card-title">{service.name}</div>
                            <div className="step-three-service-card-icons">
                              <button
                                className="step-three-service-icon"
                                aria-label={`Edit ${service.name}`}
                                onClick={() => openServiceEditor(speciality.name, service)}
                              >
                                <IoPencil size={14} />
                              </button>
                              <button
                                className="step-three-service-icon"
                                aria-label={`Delete ${service.name}`}
                                onClick={() => handleRemoveService(speciality.name, service.name)}
                              >
                                <MdDeleteForever size={16} />
                              </button>
                            </div>
                          </div>
                          <div className="step-three-service-card-meta">
                            {service.durationMinutes} min • ${service.cost}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div
                    className="step-three-picker-host"
                    ref={(element) => {
                      servicePickerRefs.current[speciality.name] = element;
                    }}
                  >
                    <div className="step-three-selected-actions">
                      <button
                        className="step-three-inline-action"
                        onClick={() =>
                          setActiveServiceSearchFor(isServiceSearchOpen ? null : speciality.name)
                        }
                      >
                        <IoAdd size={16} />
                        <span>Add service</span>
                      </button>
                    </div>

                    {isServiceSearchOpen ? (
                      <div className="step-three-service-search-panel">
                        <div className="step-three-service-search">
                          <IoSearch className="step-three-search-icon" size={16} />
                          <input
                            className="step-three-speciality-input"
                            name={`${speciality.name}-service-search`}
                            placeholder={`Search services for ${speciality.name}`}
                            value={serviceQuery}
                            onChange={(event) =>
                              setServiceQueries((previous) => ({
                                ...previous,
                                [speciality.name]: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="step-three-picker-dropdown step-three-picker-dropdown--overlay">
                          {availableServices.length > 0 ? (
                            availableServices.slice(0, 6).map((service, serviceIndex) => (
                              <button
                                key={`${speciality.name}-${service.name}-${serviceIndex}`}
                                className="step-three-picker-option"
                                onClick={() => startServiceCreation(speciality.name, service)}
                              >
                                <div className="step-three-picker-option-title">{service.name}</div>
                                <div className="step-three-picker-option-copy">
                                  {service.durationMinutes} min • ${service.cost}
                                </div>
                              </button>
                            ))
                          ) : (
                            <button
                              type="button"
                              className="step-three-picker-option step-three-picker-option--empty"
                              onClick={() => handleCreateCustomService(speciality.name)}
                            >
                              Add custom service “{serviceQuery.trim()}”
                            </button>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {error ? <div className="step-inline-error">{error}</div> : null}
      </div>

      <div className="step-buttons">
        <Secondary href="#" text="Back" style={{ width: '160px' }} onClick={prevStep} />
        <Primary
          href="#"
          text={isSubmitting ? 'Saving...' : 'Next'}
          style={{ width: '160px' }}
          isDisabled={isSubmitting}
          onClick={handleSubmit}
        />
      </div>

      <CenterModal
        showModal={isServiceModalOpen}
        setShowModal={setIsServiceModalOpen}
        onClose={closeServiceEditor}
        containerClassName="sm:w-[560px]"
      >
        <ModalHeader title="Edit service" onClose={closeServiceEditor} />
        <div className="step-three-modal-body">
          <div className="step-three-modal-copy">
            Update the service name, duration, and price before you finish onboarding.
          </div>
          <div className="step-three-modal-grid">
            <FormInput
              intype="text"
              inname="service-name"
              value={serviceEditor?.service.name ?? ''}
              inlabel="Service name"
              onChange={handleServiceNameChange}
            />
            <div className="step-two-input">
              <FormInput
                intype="number"
                inname="service-duration"
                value={String(serviceEditor?.service.durationMinutes ?? 30)}
                inlabel="Duration (mins)"
                onChange={handleServiceDurationChange}
              />
              <FormInput
                intype="number"
                inname="service-price"
                value={String(serviceEditor?.service.cost ?? 0)}
                inlabel={`Price (${currency})`}
                onChange={handleServiceCostChange}
              />
            </div>
          </div>
          <div className="step-three-modal-actions">
            <Secondary href="#" text="Cancel" onClick={closeServiceEditor} />
            <Primary href="#" text="Save service" onClick={handleSaveService} />
          </div>
        </div>
      </CenterModal>
    </div>
  );
};

export default SpecialityStep;
