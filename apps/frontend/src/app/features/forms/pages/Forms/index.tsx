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
  useServicesForPrimaryOrgSpecialities,
} from '@/app/hooks/useSpecialities';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import { usePermissions } from '@/app/hooks/usePermissions';
import { PERMISSIONS } from '@/app/lib/permissions';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import Fallback from '@/app/ui/overlays/Fallback';

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
  useLoadSpecialitiesForPrimaryOrg();
  const services = useServicesForPrimaryOrgSpecialities();
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

  const serviceOptions = useMemo(
    () =>
      services.map((s) => ({
        label: s.name,
        value: s.id || (s as any)._id || s.name,
      })),
    [services]
  );

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

  return (
    <div className="flex flex-col gap-4 pl-3! pr-3! pt-3! pb-3! md:pl-5! md:pr-5! md:pt-5! md:pb-5! lg:pl-5! lg:pr-5! lg:pt-5! lg:pb-5!">
      <div className="flex justify-between items-center w-full flex-wrap gap-2">
        <div className="flex flex-col gap-1">
          <div className="text-text-primary text-heading-1 flex items-center gap-2">
            <span>
              Templates
              <span className="text-text-tertiary">{` (${list.length})`}</span>
            </span>
            <GlassTooltip
              content="Build and reuse templates, link them to services, and use custom available templates."
              side="bottom"
            >
              <button
                type="button"
                aria-label="Templates info"
                className="relative top-[3px] inline-flex h-5 w-5 shrink-0 items-center justify-center leading-none text-text-secondary hover:text-text-primary transition-colors"
              >
                <IoInformationCircleOutline size={20} />
              </button>
            </GlassTooltip>
          </div>
        </div>
        {canEditForms && <Primary href="#" text="Add" onClick={openAddForm} />}
      </div>

      <PermissionGate allOf={[PERMISSIONS.FORMS_VIEW_ANY]} fallback={<Fallback />}>
        <div className="w-full flex flex-col gap-3">
          <FormsFilters
            list={list}
            setFilteredList={setFilteredList}
            searchQuery={headerSearchQuery}
          />
          <FormsTable
            filteredList={filteredList}
            activeForm={activeForm}
            setActiveForm={handleSelectForm}
            setViewPopup={setViewPopup}
            loading={loading}
          />
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
