'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import { Primary } from '@/app/ui/primitives/Buttons';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import { IoInformationCircleOutline } from 'react-icons/io5';
import { FormsProps } from '@/app/features/forms/types/forms';
import FormsFilters from '@/app/ui/filters/FormsFilters';
import FormsTable from '@/app/ui/tables/FormsTable';
import AddForm from '@/app/features/forms/pages/Forms/Sections/AddForm';
import FormInfo from '@/app/features/forms/pages/Forms/Sections/FormInfo';
import { useFormsStore } from '@/app/stores/formsStore';
import { loadForms } from '@/app/features/forms/services/formService';
import { useSearchStore } from '@/app/stores/searchStore';
import {
  useLoadSpecialitiesForPrimaryOrg,
  useSpecialitiesForPrimaryOrg,
  useServicesForPrimaryOrgSpecialities,
} from '@/app/hooks/useSpecialities';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import { usePermissions } from '@/app/hooks/usePermissions';
import { PERMISSIONS } from '@/app/lib/permissions';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import Fallback from '@/app/ui/overlays/Fallback';
import { getPlannerLayoutClassNames, usePlannerAutoLock } from '@/app/hooks/usePlannerLayout';

const Forms = () => {
  const { can } = usePermissions();
  const canEditForms = can(PERMISSIONS.FORMS_EDIT_ANY);
  const { formsById, formIds, activeFormId, setActiveForm, loading } = useFormsStore();
  const headerSearchQuery = useSearchStore((s) => s.query);
  const searchParams = useSearchParams();
  const handledDeepLinkRef = useRef<string | null>(null);
  const [filteredList, setFilteredList] = useState<FormsProps[]>([]);
  const [addPopup, setAddPopup] = useState(false);
  const [viewPopup, setViewPopup] = useState(false);
  const [editingForm, setEditingForm] = useState<FormsProps | null>(null);
  const [draftForm, setDraftForm] = useState<FormsProps | null>(null);
  const { plannerSectionRef } = usePlannerAutoLock({ activeView: 'list', topOffset: 72 });
  useLoadSpecialitiesForPrimaryOrg();
  const services = useServicesForPrimaryOrgSpecialities();
  const specialities = useSpecialitiesForPrimaryOrg();
  const fetchedRef = useRef(false);

  const list = useMemo<FormsProps[]>(
    () => formIds.map((id) => formsById[id]).filter(Boolean),
    [formIds, formsById]
  );

  const activeForm: FormsProps | null = useMemo(() => {
    const current = activeFormId ? formsById[activeFormId] : null;
    if (current) {
      const presentInFilter = filteredList.some((f) => f._id === current._id);
      if (presentInFilter) return current;
    }
    return filteredList[0] ?? null;
  }, [activeFormId, filteredList, formsById]);

  useEffect(() => {
    setFilteredList(list);
  }, [list]);

  const serviceOptions = useMemo(() => {
    const specialityNameById = new Map(
      specialities.map((speciality) => [String((speciality as any)._id ?? ''), speciality.name])
    );
    const serviceNameFrequency = new Map<string, number>();

    for (const service of services) {
      const serviceName = String(service.name ?? '')
        .trim()
        .toLowerCase();
      if (!serviceName) continue;
      serviceNameFrequency.set(serviceName, (serviceNameFrequency.get(serviceName) ?? 0) + 1);
    }

    return services.map((service) => {
      const serviceName = String(service.name ?? '').trim();
      const duplicateServiceName =
        serviceNameFrequency.get(serviceName.toLowerCase()) !== undefined &&
        serviceNameFrequency.get(serviceName.toLowerCase())! > 1;
      const specialityLabel =
        specialityNameById.get(String(service.specialityId ?? '')) ?? 'Unknown Speciality';

      return {
        label:
          duplicateServiceName && serviceName ? `${specialityLabel} / ${serviceName}` : serviceName,
        value: service.id || (service as any)._id || service.name,
      };
    });
  }, [services, specialities]);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    void (async () => {
      try {
        if (!list.length) {
          await loadForms();
        }
      } catch (err) {
        console.error('Failed to load forms', err);
      }
    })();
  }, [list.length]);

  useEffect(() => {
    if (!filteredList.length) {
      setActiveForm(null);
      return;
    }
    const isActiveInFilter = activeFormId && filteredList.some((item) => item._id === activeFormId);
    if (!isActiveInFilter) {
      const first = filteredList[0];
      if (first?._id) setActiveForm(first._id);
    }
  }, [activeFormId, filteredList, setActiveForm]);

  useEffect(() => {
    const formId = String(searchParams.get('formId') ?? '').trim();
    if (!formId) return;
    if (handledDeepLinkRef.current === formId) return;

    const target = list.find((form) => form?._id === formId);
    if (!target?._id) return;

    setActiveForm(target._id);
    setViewPopup(true);
    handledDeepLinkRef.current = formId;
  }, [list, searchParams, setActiveForm]);

  const openAddForm = () => {
    setEditingForm(null);
    setAddPopup(true);
  };

  const openEditForm = (form: FormsProps) => {
    setDraftForm(null);
    setEditingForm(form);
    setViewPopup(false);
    setAddPopup(true);
  };

  const handleAddClose = () => {
    if (editingForm) {
      setDraftForm(null);
    }
    setEditingForm(null);
  };

  const handleSelectForm = (form: FormsProps) => {
    if (form?._id) {
      setActiveForm(form._id);
    }
  };
  const { wrapperClassName, plannerSectionClassName } = getPlannerLayoutClassNames({
    activeView: 'list',
    listWrapperClassName:
      'w-full flex flex-col gap-3 h-[calc(100vh-236px)] min-h-[540px] max-h-[calc(100vh-236px)] lg:sticky lg:top-4 lg:mb-0 lg:h-[calc(100dvh-104px)] lg:min-h-[calc(100dvh-104px)] lg:max-h-[calc(100dvh-104px)]',
    plannerClassName: '',
  });

  return (
    <div className="relative min-w-0 flex h-full min-h-0 flex-col gap-4 pl-3! pr-3! pt-3! pb-3! md:pl-5! md:pr-5! md:pt-5! md:pb-3! lg:pl-5! lg:pr-5! lg:pt-5! lg:pb-3!">
      <div className="flex justify-between items-center w-full flex-wrap gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-text-primary text-heading-2 flex items-center gap-2">
            <span>
              {'Templates'}
              <span className="text-body-2 text-text-tertiary">{` (${list.length})`}</span>
            </span>
            <GlassTooltip
              content="Build and reuse templates, link them to services, and use custom available templates."
              side="bottom"
            >
              <button
                type="button"
                aria-label="Templates info"
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center leading-none translate-y-px text-text-secondary hover:text-text-primary transition-colors"
              >
                <IoInformationCircleOutline size={20} />
              </button>
            </GlassTooltip>
          </h1>
        </div>
      </div>

      <PermissionGate allOf={[PERMISSIONS.FORMS_VIEW_ANY]} fallback={<Fallback />}>
        <div className={wrapperClassName}>
          <FormsFilters
            list={list}
            setFilteredList={setFilteredList}
            searchQuery={headerSearchQuery}
            categoryAction={
              canEditForms ? <Primary href="#" text="Add" onClick={openAddForm} /> : null
            }
          />
          <div ref={plannerSectionRef} className={plannerSectionClassName}>
            <FormsTable
              filteredList={filteredList}
              setActiveForm={handleSelectForm}
              setViewPopup={setViewPopup}
              loading={loading}
            />
          </div>
        </div>

        <AddForm
          key={editingForm?._id ? `edit-${editingForm._id}` : 'add-form'}
          showModal={addPopup}
          setShowModal={setAddPopup}
          initialForm={editingForm}
          onClose={handleAddClose}
          serviceOptions={serviceOptions}
          draft={editingForm ? null : draftForm}
          onDraftChange={(d) => !editingForm && setDraftForm(d)}
        />
        {activeForm && (
          <FormInfo
            showModal={viewPopup}
            setShowModal={setViewPopup}
            activeForm={activeForm}
            onEdit={openEditForm}
            serviceOptions={serviceOptions}
            canEdit={canEditForms}
          />
        )}
      </PermissionGate>
    </div>
  );
};

const ProtectedForms = () => {
  return (
    <ProtectedRoute>
      <OrgGuard>
        <Forms />
      </OrgGuard>
    </ProtectedRoute>
  );
};

export default ProtectedForms;
