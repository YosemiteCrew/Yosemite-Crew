'use client';
import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import PageSkeleton from '@/app/ui/layout/PageSkeleton';

const FORMS_PAGE_SKELETON = <PageSkeleton variant="list" />;
import { Primary } from '@/app/ui/primitives/Buttons';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import { IoAdd, IoInformationCircleOutline } from 'react-icons/io5';
import { FormsProps } from '@/app/features/forms/types/forms';
import FormsFilters, { type FormsFilterState } from '@/app/ui/filters/FormsFilters';
import FormsTable from '@/app/ui/tables/FormsTable';
import { useFormsStore } from '@/app/stores/formsStore';
import { loadForms } from '@/app/features/forms/services/formService';
import { useSearchStore } from '@/app/stores/searchStore';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import { useOrgStore } from '@/app/stores/orgStore';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import { usePermissions } from '@/app/hooks/usePermissions';
import { PERMISSIONS } from '@/app/lib/permissions';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import Fallback from '@/app/ui/overlays/Fallback';
import { getPlannerLayoutClassNames, usePlannerAutoLock } from '@/app/hooks/usePlannerLayout';
import MobileSearchBar from '@/app/ui/layout/MobileSearchBar/MobileSearchBar';

const AddForm = dynamic(() => import('@/app/features/forms/pages/Forms/Sections/AddForm'));
const FormInfo = dynamic(() => import('@/app/features/forms/pages/Forms/Sections/FormInfo'));

type CatalogSelectableEntry = {
  id?: string;
  name?: unknown;
  status?: string;
  organisationId?: string;
  specialityId?: unknown;
  isInpatientPreferred?: boolean;
};

/**
 * Coerce a catalog field (typed `unknown` by the stores) to a string for display
 * or map-key use without falling back to an object's `[object Object]`
 * stringification. Primitives round-trip; anything else becomes an empty string.
 */
const toPrimitiveString = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? String(value)
    : '';

/**
 * Catalog stores accumulate entries across organisations, so an entry is only
 * selectable here when it belongs to the organisation currently in context.
 */
const toActiveCatalogItems = (
  entries: readonly CatalogSelectableEntry[],
  badge: 'Service' | 'Package',
  organisationId: string | null | undefined
) =>
  entries.reduce<
    Array<{
      id: CatalogSelectableEntry['id'];
      name: string;
      specialityId: CatalogSelectableEntry['specialityId'];
      badge: 'Service' | 'Package';
      isInpatient: boolean;
    }>
  >((items, entry) => {
    // Single pass: filter to the active, in-context entries and shape them at
    // once instead of chaining .filter().map() (two iterations).
    if (entry.status === 'ACTIVE' && entry.organisationId === organisationId) {
      items.push({
        id: entry.id,
        name: toPrimitiveString(entry.name).trim(),
        specialityId: entry.specialityId,
        badge,
        isInpatient: entry.isInpatientPreferred === true,
      });
    }
    return items;
  }, []);

const Forms = () => {
  const permissions = usePermissions();
  const canEditForms = permissions.can(PERMISSIONS.FORMS_EDIT_ANY);
  const formsStore = useFormsStore();
  const { formsById, formIds, activeFormId, loading } = formsStore;
  const headerSearchQuery = useSearchStore((s) => s.query);
  const searchParams = useSearchParams();
  const handledDeepLinkRef = useRef<string | null>(null);
  const [filters, setFilters] = useState<FormsFilterState>({ status: 'All', category: 'All' });
  const [addPopup, setAddPopup] = useState(false);
  const [viewPopup, setViewPopup] = useState(false);
  const [editingForm, setEditingForm] = useState<FormsProps | null>(null);
  const [draftForm, setDraftForm] = useState<FormsProps | null>(null);
  const { plannerSectionRef } = usePlannerAutoLock({ activeView: 'list', topOffset: 72 });
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const specialities = useRevampCatalogStore((s) => s.specialities);
  const services = useRevampCatalogStore((s) => s.services);
  const packages = useRevampCatalogStore((s) => s.packages);
  const loadOrganisationCatalog = useRevampCatalogStore((s) => s.loadOrganisationCatalog);
  const loadSpecialityCatalog = useRevampCatalogStore((s) => s.loadSpecialityCatalog);
  const fetchedRef = useRef(false);

  const orgSpecialities = useMemo(
    () => (primaryOrgId ? specialities.filter((s) => s.organisationId === primaryOrgId) : []),
    [primaryOrgId, specialities]
  );

  useEffect(() => {
    if (!primaryOrgId) return;
    Promise.resolve(loadOrganisationCatalog(primaryOrgId)).catch(() => undefined);
  }, [primaryOrgId, loadOrganisationCatalog]);

  useEffect(() => {
    if (!primaryOrgId) return;
    for (const speciality of orgSpecialities) {
      Promise.resolve(loadSpecialityCatalog(primaryOrgId, speciality.id)).catch(() => undefined);
    }
  }, [primaryOrgId, orgSpecialities, loadSpecialityCatalog]);

  const list = useMemo<FormsProps[]>(
    () =>
      formIds.flatMap((id) => {
        const form = formsById[id];
        return form ? [form] : [];
      }),
    [formIds, formsById]
  );

  const filteredList = useMemo(() => {
    const q = headerSearchQuery.trim().toLowerCase();
    return list.filter((item) => {
      const matchesStatus = filters.status === 'All' || item.status === filters.status;
      const matchesCategory = filters.category === 'All' || item.category === filters.category;
      const matchesQuery =
        !q || item.name?.toLowerCase().includes(q) || item.category?.toLowerCase().includes(q);
      return matchesStatus && matchesCategory && matchesQuery;
    });
  }, [filters, headerSearchQuery, list]);

  const activeForm: FormsProps | null = useMemo(() => {
    const current = activeFormId ? formsById[activeFormId] : null;
    if (current) {
      const presentInFilter = filteredList.some((f) => f._id === current._id);
      if (presentInFilter) return current;
    }
    return filteredList[0] ?? null;
  }, [activeFormId, filteredList, formsById]);

  const serviceOptions = useMemo(() => {
    const specialityNameById = new Map(
      orgSpecialities.map((speciality) => [String(speciality.id ?? ''), speciality.name])
    );

    const catalogItems = [
      ...toActiveCatalogItems(services, 'Service', primaryOrgId),
      ...toActiveCatalogItems(packages, 'Package', primaryOrgId),
    ];

    const nameFrequency = new Map<string, number>();
    for (const item of catalogItems) {
      const key = item.name.toLowerCase();
      if (!key) continue;
      nameFrequency.set(key, (nameFrequency.get(key) ?? 0) + 1);
    }

    const options = [];
    for (const item of catalogItems) {
      if (!item.id || !item.name) continue;
      const duplicateName = (nameFrequency.get(item.name.toLowerCase()) ?? 0) > 1;
      const specialityLabel =
        specialityNameById.get(toPrimitiveString(item.specialityId)) ?? 'Unknown Speciality';
      options.push({
        label: duplicateName ? `${specialityLabel} / ${item.name}` : item.name,
        value: item.id,
        badge: item.badge,
        isInpatient: item.isInpatient,
      });
    }
    return options;
  }, [services, packages, orgSpecialities, primaryOrgId]);

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
    const { setActiveForm } = useFormsStore.getState();
    if (!filteredList.length) {
      setActiveForm(null);
      return;
    }
    const isActiveInFilter = activeFormId && filteredList.some((item) => item._id === activeFormId);
    if (!isActiveInFilter) {
      const first = filteredList[0];
      if (first?._id) setActiveForm(first._id);
    }
  }, [activeFormId, filteredList]);

  useEffect(() => {
    const formId = String(searchParams.get('formId') ?? '').trim();
    if (!formId) return;
    if (handledDeepLinkRef.current === formId) return;

    const target = list.find((form) => form?._id === formId);
    if (!target?._id) return;

    useFormsStore.getState().setActiveForm(target._id);
    setViewPopup(true);
    handledDeepLinkRef.current = formId;
  }, [list, searchParams]);

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
      formsStore.setActiveForm(form._id);
    }
  };
  const { wrapperClassName, plannerSectionClassName } = getPlannerLayoutClassNames({
    activeView: 'list',
    listWrapperClassName:
      'w-full flex flex-col gap-3 h-[calc(100vh-236px)] min-h-[540px] max-h-[calc(100vh-236px)] lg:sticky lg:top-4 lg:mb-0 lg:h-[calc(100dvh-104px)] lg:min-h-[calc(100dvh-104px)] lg:max-h-[calc(100dvh-104px)]',
    plannerClassName: '',
  });

  return (
    <div className="relative min-w-0 h-full min-h-0 yc-page-content">
      <div className="flex justify-between items-center w-full flex-wrap gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-page-title flex items-center gap-2">
            <span>
              {'Templates'} <span className="text-page-title-count">{`(${list.length})`}</span>
            </span>
            <GlassTooltip
              content="Build and reuse templates, link them to services, and use custom available templates."
              side="bottom"
            >
              <button
                type="button"
                aria-label="Templates info"
                className="inline-flex size-5 shrink-0 items-center justify-center leading-none translate-y-px text-text-secondary hover:text-text-primary transition-colors"
              >
                <IoInformationCircleOutline size={20} />
              </button>
            </GlassTooltip>
          </h1>
          <p className="text-[13.5px] text-text-secondary">
            Build and reuse templates, link them to services and packages
          </p>
        </div>
      </div>

      <MobileSearchBar placeholder="Search templates" />
      <PermissionGate allOf={[PERMISSIONS.FORMS_VIEW_ANY]} fallback={<Fallback />}>
        <div className={wrapperClassName}>
          <FormsFilters
            filters={filters}
            onFiltersChange={setFilters}
            categoryAction={
              canEditForms ? (
                <Primary
                  href="#"
                  text="Add"
                  onClick={openAddForm}
                  icon={<IoAdd size={18} aria-hidden="true" />}
                />
              ) : null
            }
          />
          <div ref={plannerSectionRef} className={plannerSectionClassName}>
            <FormsTable
              filteredList={filteredList}
              setActiveForm={handleSelectForm}
              setViewPopup={setViewPopup}
              loading={loading}
              showLinkedServices
              serviceOptions={serviceOptions}
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
    <ProtectedRoute skeleton={FORMS_PAGE_SKELETON}>
      <OrgGuard skeleton={FORMS_PAGE_SKELETON}>
        <Suspense fallback={FORMS_PAGE_SKELETON}>
          <Forms />
        </Suspense>
      </OrgGuard>
    </ProtectedRoute>
  );
};

export default ProtectedForms;
