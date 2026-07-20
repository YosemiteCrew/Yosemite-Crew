'use client';
import React, { Suspense, useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import PageSkeleton from '@/app/ui/layout/PageSkeleton';

const COMPANIONS_PAGE_SKELETON = <PageSkeleton variant="list" />;
import Filters from '@/app/ui/filters/Filters';
import CompanionsTable, { type CompanionsViewMode } from '@/app/ui/tables/CompanionsTable';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import { useCompanionsParentsForPrimaryOrg } from '@/app/hooks/useCompanion';
import { useAppointmentsForPrimaryOrg } from '@/app/hooks/useAppointments';
import {
  CompanionParent,
  CompanionsStatusFilters,
} from '@/app/features/companions/pages/Companions/types';
import { useSearchStore } from '@/app/stores/searchStore';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import { PERMISSIONS } from '@/app/lib/permissions';
import Fallback from '@/app/ui/overlays/Fallback';
import { usePermissions } from '@/app/hooks/usePermissions';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import { Primary } from '@/app/ui/primitives/Buttons';
import {
  IoAdd,
  IoGridOutline,
  IoInformationCircleOutline,
  IoReorderThreeOutline,
  IoSwapVerticalOutline,
} from 'react-icons/io5';
import clsx from 'clsx';
import { formatCompanionNameWithOwnerLastName } from '@/app/lib/companionName';
import { getPlannerLayoutClassNames, usePlannerAutoLock } from '@/app/hooks/usePlannerLayout';
import MobileSearchBar from '@/app/ui/layout/MobileSearchBar/MobileSearchBar';
import { usePhonePrimaryAction } from '@/app/ui/layout/PhoneShell/usePhonePrimaryAction';
import { isCompanionRevampEnabled } from '@/app/lib/featureFlags';
import { useCompanionTerminologyText } from '@/app/hooks/useCompanionTerminologyText';
import InClinicTodayBand from '@/app/features/companions/pages/Companions/InClinicTodayBand';
import SpeciesTabs from '@/app/features/companions/pages/Companions/SpeciesTabs';
import {
  getActiveCount,
  getSpeciesCounts,
  sortByLastVisit,
} from '@/app/features/companions/pages/Companions/companionsDirectory';

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
  const appointments = useAppointmentsForPrimaryOrg();
  const permissions = usePermissions();
  const canEditCompanions = permissions.can(PERMISSIONS.COMPANIONS_EDIT_ANY);
  const canEditAppointments = permissions.can(PERMISSIONS.APPOINTMENTS_EDIT_ANY);
  const canEditTasks = permissions.can(PERMISSIONS.TASKS_EDIT_ANY);
  const query = useSearchStore((s) => s.query);
  const searchParams = useSearchParams();
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
  const [viewMode, setViewMode] = useState<CompanionsViewMode>('list');
  const [sortByRecentVisit, setSortByRecentVisit] = useState(false);
  const { plannerSectionRef } = usePlannerAutoLock({ activeView: 'list', topOffset: 72 });

  const openAddCompanion = () => setAddPopup(true);

  // The phone shell's FAB has no reference to this page's create flow; opt in so
  // "New companion" opens the same modal the desktop button does.
  usePhonePrimaryAction('companion', openAddCompanion);

  const patientsCount = companions.length;
  const activeCount = useMemo(() => getActiveCount(companions), [companions]);
  const speciesCounts = useMemo(() => getSpeciesCounts(companions), [companions]);

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

  // Render-phase adjustment: open the companion view when a deep link points
  // at a companion we have loaded, once per companion id.
  const [handledDeepLink, setHandledDeepLink] = useState<string | null>(null);
  const deepLinkCompanionId = String(searchParams.get('companionId') ?? '').trim();
  if (deepLinkCompanionId && deepLinkCompanionId !== handledDeepLink) {
    const target = companions.find((item) => item.companion.id === deepLinkCompanionId);
    if (target) {
      setHandledDeepLink(deepLinkCompanionId);
      setActiveCompanion(target);
      setCompanionInfoInitialLabel('info');
      setViewCompanion(true);
    }
  }

  // The deep link is a one-shot instruction, not page state: once it has opened
  // the modal, drop `companionId` from the URL so this history entry no longer
  // carries it. Without this the entry stays `/companions?companionId=…`, and
  // navigating back to it (browser Back from the overview) replays the deep
  // link and spuriously re-opens the patient modal.
  //
  // `history.replaceState` rather than `router.replace`: this is a same-route
  // rewrite of the current history entry, not a navigation. Next integrates it
  // with the App Router, so the entry loses the param without re-running the
  // route, which router.replace would do for a URL the user never travelled to.
  useEffect(() => {
    if (!deepLinkCompanionId || deepLinkCompanionId !== handledDeepLink) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete('companionId');
    const rest = params.toString();
    window.history.replaceState(null, '', rest ? `/companions?${rest}` : '/companions');
  }, [deepLinkCompanionId, handledDeepLink, searchParams]);

  const filteredList = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filterWanted = activeFilter.toLowerCase();
    const statusWanted = activeStatus.toLowerCase();

    const matched = companions.filter((item) => {
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

    return sortByRecentVisit ? sortByLastVisit(matched, appointments) : matched;
  }, [companions, activeStatus, activeFilter, query, sortByRecentVisit, appointments]);
  const { wrapperClassName, plannerSectionClassName } = getPlannerLayoutClassNames({
    activeView: 'list',
    listWrapperClassName:
      'w-full flex flex-col gap-3 h-[calc(100vh-236px)] min-h-[540px] max-h-[calc(100vh-236px)] lg:sticky lg:top-4 lg:mb-0 lg:h-[calc(100dvh-104px)] lg:min-h-[calc(100dvh-104px)] lg:max-h-[calc(100dvh-104px)]',
    plannerClassName: '',
  });

  return (
    <div className="relative min-w-0 h-full min-h-0 yc-page-content">
      <div className="flex justify-between items-end w-full flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-page-title flex items-baseline gap-2 flex-wrap">
            <span className="flex items-baseline gap-3">
              {terminologyText('Companions')}
              <span className="font-newsreader text-[16px] italic text-[var(--ink-faint)]">
                {`${patientsCount} patients, ${activeCount} active`}
              </span>
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
          <p className="text-[13.5px] text-[var(--ink-muted)]">
            {terminologyText('Every patient linked to the clinic, with their parents')}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="hidden items-center rounded-full border border-[var(--hairline)] bg-[var(--field-bg)] p-[3px] md:flex">
            <button
              type="button"
              aria-label={terminologyText('List view')}
              aria-pressed={viewMode === 'list'}
              onClick={() => setViewMode('list')}
              className={clsx(
                'flex h-7 w-8 items-center justify-center rounded-full transition-colors',
                viewMode === 'list'
                  ? 'bg-[var(--screen)] text-[var(--ink)] shadow-[0_1px_2px_var(--sh10)]'
                  : 'text-[var(--ink-faint)]'
              )}
            >
              <IoReorderThreeOutline size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={terminologyText('Grid view')}
              aria-pressed={viewMode === 'grid'}
              onClick={() => setViewMode('grid')}
              className={clsx(
                'flex h-7 w-8 items-center justify-center rounded-full transition-colors',
                viewMode === 'grid'
                  ? 'bg-[var(--screen)] text-[var(--ink)] shadow-[0_1px_2px_var(--sh10)]'
                  : 'text-[var(--ink-faint)]'
              )}
            >
              <IoGridOutline size={13} aria-hidden="true" />
            </button>
          </span>
          {canEditCompanions && (
            <Primary
              text={terminologyText('Add companion')}
              onClick={openAddCompanion}
              icon={<IoAdd size={18} aria-hidden="true" />}
              className="max-md:hidden! shrink-0"
            />
          )}
        </div>
      </div>
      <MobileSearchBar placeholder={terminologyText('Search companions')} />
      <PermissionGate allOf={[PERMISSIONS.COMPANIONS_VIEW_ANY]} fallback={<Fallback />}>
        <div className={wrapperClassName}>
          <InClinicTodayBand companions={companions} />
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--divider)]">
            <div className="max-w-full overflow-x-auto scrollbar-hidden">
              <SpeciesTabs
                counts={speciesCounts}
                activeFilter={activeFilter}
                onSelect={setActiveFilter}
              />
            </div>
            <div className="flex items-center gap-2 pb-[7px]">
              <Filters
                statusOptions={CompanionsStatusFilters}
                activeStatus={activeStatus}
                setActiveStatus={setActiveStatus}
                showAddButton={false}
              />
              <button
                type="button"
                aria-pressed={sortByRecentVisit}
                onClick={() => setSortByRecentVisit((value) => !value)}
                className={clsx(
                  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors',
                  sortByRecentVisit
                    ? 'border-[var(--divider)] bg-[var(--inset)] text-[var(--ink)]'
                    : 'border-[var(--hairline)] text-[var(--ink-muted)] hover:text-[var(--ink)]'
                )}
              >
                <IoSwapVerticalOutline size={12} aria-hidden="true" />
                {terminologyText('Last visit')}
              </button>
            </div>
          </div>
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
              viewMode={viewMode}
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
