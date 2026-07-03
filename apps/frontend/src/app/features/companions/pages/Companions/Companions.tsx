'use client';
import React, { Suspense, useState, useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import PageSkeleton from '@/app/ui/layout/PageSkeleton';

const COMPANIONS_PAGE_SKELETON = <PageSkeleton variant="list" />;
import Filters from '@/app/ui/filters/Filters';
import CompanionsTable from '@/app/ui/tables/CompanionsTable';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import { useCompanionsParentsForPrimaryOrg } from '@/app/hooks/useCompanion';
import {
  CompanionParent,
  CompanionsSpeciesFilters,
  CompanionsStatusFilters,
} from '@/app/features/companions/pages/Companions/types';
import { useSearchStore } from '@/app/stores/searchStore';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import { PERMISSIONS } from '@/app/lib/permissions';
import Fallback from '@/app/ui/overlays/Fallback';
import { usePermissions } from '@/app/hooks/usePermissions';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import { IoInformationCircleOutline } from 'react-icons/io5';
import { formatCompanionNameWithOwnerLastName } from '@/app/lib/companionName';
import { getPlannerLayoutClassNames, usePlannerAutoLock } from '@/app/hooks/usePlannerLayout';
import MobileSearchBar from '@/app/ui/layout/MobileSearchBar/MobileSearchBar';
import { isCompanionRevampEnabled } from '@/app/lib/featureFlags';
import { useCompanionTerminologyText } from '@/app/hooks/useCompanionTerminologyText';

const AddCompanion = dynamic(() => import('@/app/features/companions/components/AddCompanion'));
const AddCompanionCentralModal = dynamic(
  () => import('@/app/features/companions/components/AddCompanionCentralModal')
);
const CompanionInfo = dynamic(() =>
  import('@/app/features/companions/components').then((m) => ({ default: m.CompanionInfo }))
);
const BookAppointment = dynamic(
  () => import('@/app/features/companions/pages/Companions/BookAppointment')
);
const AddAppointmentCentralModal = dynamic(
  () => import('@/app/features/appointments/pages/Appointments/Sections/AddAppointmentCentralModal')
);
const AddTask = dynamic(() => import('@/app/features/companions/pages/Companions/AddTask'));
const ChangeCompanionStatus = dynamic(
  () => import('@/app/features/companions/pages/Companions/ChangeStatus')
);

const Companions = () => {
  const terminologyText = useCompanionTerminologyText();
  const companions = useCompanionsParentsForPrimaryOrg();
  const permissions = usePermissions();
  const canEditCompanions = permissions.can(PERMISSIONS.COMPANIONS_EDIT_ANY);
  const canEditAppointments = permissions.can(PERMISSIONS.APPOINTMENTS_EDIT_ANY);
  const canEditTasks = permissions.can(PERMISSIONS.TASKS_EDIT_ANY);
  const query = useSearchStore((s) => s.query);
  const searchParams = useSearchParams();
  const handledDeepLinkRef = useRef<string | null>(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeStatus, setActiveStatus] = useState('all');
  const [addPopup, setAddPopup] = useState(false);
  const [viewCompanion, setViewCompanion] = useState(false);
  const [companionInfoInitialLabel, setCompanionInfoInitialLabel] = useState<'info' | 'history'>(
    'info'
  );
  const [activeCompanion, setActiveCompanion] = useState<CompanionParent | null>(
    companions[0] ?? null
  );
  const [bookAppointment, setBookAppointment] = useState(false);
  const [addTask, setAddTask] = useState(false);
  const [changeStatusPopup, setChangeStatusPopup] = useState(false);
  const { plannerSectionRef } = usePlannerAutoLock({ activeView: 'list', topOffset: 72 });

  useEffect(() => {
    setActiveCompanion((prev) => {
      if (companions.length === 0) return null;
      if (prev?.companion.id) {
        const updated = companions.find((s) => s.companion.id === prev.companion.id);
        if (updated) return updated;
      }
      return companions[0];
    });
  }, [companions]);

  useEffect(() => {
    const companionId = String(searchParams.get('companionId') ?? '').trim();
    if (!companionId) return;
    if (handledDeepLinkRef.current === companionId) return;

    const target = companions.find((item) => item.companion.id === companionId);
    if (!target) return;

    setActiveCompanion(target);
    setCompanionInfoInitialLabel('info');
    setViewCompanion(true);
    handledDeepLinkRef.current = companionId;
  }, [companions, searchParams]);

  const filteredList = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filterWanted = activeFilter.toLowerCase();
    const statusWanted = activeStatus.toLowerCase();

    return companions.filter((item) => {
      const status = item.companion.status?.toLowerCase() ?? 'inactive';
      const filter = item.companion.type?.toLowerCase() ?? '';

      const matchesStatus = statusWanted === 'all' || status === statusWanted;
      const matchesFilter = filterWanted === 'all' || filter === filterWanted;
      const companionDisplayName = formatCompanionNameWithOwnerLastName(
        item.companion.name,
        item.parent,
        ''
      ).toLowerCase();
      const matchesQuery = !q || companionDisplayName.includes(q);

      return matchesStatus && matchesFilter && matchesQuery;
    });
  }, [companions, activeStatus, activeFilter, query]);
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
              {terminologyText('Companions')}
              <span className="text-body-2 text-text-tertiary">{` (${companions.length})`}</span>
            </span>
            <GlassTooltip
              content={terminologyText(
                'View companion and parent details, access their documents, and jump into related tasks or appointments without leaving the profile.'
              )}
              side="bottom"
            >
              <button
                type="button"
                aria-label={terminologyText('Companions info')}
                className="inline-flex size-5 shrink-0 items-center justify-center leading-none translate-y-px text-text-secondary hover:text-text-primary transition-colors"
              >
                <IoInformationCircleOutline size={20} />
              </button>
            </GlassTooltip>
          </h1>
        </div>
      </div>
      <MobileSearchBar placeholder={terminologyText('Search companions')} />
      <PermissionGate allOf={[PERMISSIONS.COMPANIONS_VIEW_ANY]} fallback={<Fallback />}>
        <div className={wrapperClassName}>
          <Filters
            filterOptions={CompanionsSpeciesFilters}
            statusOptions={CompanionsStatusFilters}
            activeFilter={activeFilter}
            activeStatus={activeStatus}
            setActiveFilter={setActiveFilter}
            setActiveStatus={setActiveStatus}
            showAddButton={canEditCompanions}
            onAddButtonClick={() => setAddPopup((e) => !e)}
            addButtonText="Add"
            compactFilterPills
          />
          <div ref={plannerSectionRef} className={plannerSectionClassName}>
            <CompanionsTable
              filteredList={filteredList}
              setActiveCompanion={setActiveCompanion}
              setViewCompanion={setViewCompanion}
              setCompanionInfoInitialLabel={setCompanionInfoInitialLabel}
              setBookAppointment={setBookAppointment}
              setAddTask={setAddTask}
              setChangeStatusPopup={setChangeStatusPopup}
              canEditAppointments={canEditAppointments}
              canEditTasks={canEditTasks}
              canEditCompanions={canEditCompanions}
            />
          </div>
        </div>

        {isCompanionRevampEnabled() ? (
          <>
            <AddCompanionCentralModal showModal={addPopup} setShowModal={setAddPopup} />
            <AddCompanionCentralModal
              showModal={!!(activeCompanion && viewCompanion)}
              setShowModal={setViewCompanion}
              viewCompanion={activeCompanion}
              canEditCompanionStatus={canEditCompanions}
            />
          </>
        ) : (
          <>
            <AddCompanion showModal={addPopup} setShowModal={setAddPopup} />
            {activeCompanion && viewCompanion && (
              <CompanionInfo
                showModal={viewCompanion}
                setShowModal={setViewCompanion}
                activeCompanion={activeCompanion}
                canEditCompanionStatus={canEditCompanions}
                initialLabel={companionInfoInitialLabel}
              />
            )}
          </>
        )}
        {activeCompanion && canEditCompanions && (
          <ChangeCompanionStatus
            showModal={changeStatusPopup}
            setShowModal={setChangeStatusPopup}
            activeCompanion={activeCompanion}
          />
        )}
        {canEditAppointments &&
          activeCompanion &&
          (isCompanionRevampEnabled() ? (
            <AddAppointmentCentralModal
              showModal={bookAppointment}
              setShowModal={setBookAppointment}
              setActiveFilter={() => undefined}
              setActiveStatus={() => undefined}
              initialCompanionId={activeCompanion.companion.id}
            />
          ) : (
            <BookAppointment
              showModal={bookAppointment}
              setShowModal={setBookAppointment}
              activeCompanion={activeCompanion}
            />
          ))}
        {canEditTasks && activeCompanion && (
          <AddTask
            showModal={addTask}
            setShowModal={setAddTask}
            activeCompanion={activeCompanion}
          />
        )}
      </PermissionGate>
    </div>
  );
};

const ProtectedCompanions = () => {
  return (
    <ProtectedRoute skeleton={COMPANIONS_PAGE_SKELETON}>
      <OrgGuard skeleton={COMPANIONS_PAGE_SKELETON}>
        <Suspense fallback={COMPANIONS_PAGE_SKELETON}>
          <Companions />
        </Suspense>
      </OrgGuard>
    </ProtectedRoute>
  );
};

export default ProtectedCompanions;
