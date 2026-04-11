'use client';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import { Primary } from '@/app/ui/primitives/Buttons';
import Filters from '@/app/ui/filters/Filters';
import CompanionsTable from '@/app/ui/tables/CompanionsTable';
import AddCompanion from '@/app/features/companions/components/AddCompanion';
import { CompanionInfo } from '@/app/features/companions/components';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import { useCompanionsParentsForPrimaryOrg } from '@/app/hooks/useCompanion';
import {
  CompanionParent,
  CompanionsSpeciesFilters,
  CompanionsStatusFilters,
} from '@/app/features/companions/pages/Companions/types';
import BookAppointment from '@/app/features/companions/pages/Companions/BookAppointment';
import AddTask from '@/app/features/companions/pages/Companions/AddTask';
import ChangeCompanionStatus from '@/app/features/companions/pages/Companions/ChangeStatus';
import { useSearchStore } from '@/app/stores/searchStore';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import { PERMISSIONS } from '@/app/lib/permissions';
import Fallback from '@/app/ui/overlays/Fallback';
import { usePermissions } from '@/app/hooks/usePermissions';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import { IoInformationCircleOutline } from 'react-icons/io5';
import { formatCompanionNameWithOwnerLastName } from '@/app/lib/companionName';

const Companions = () => {
  const companions = useCompanionsParentsForPrimaryOrg();
  const { can } = usePermissions();
  const canEditCompanions = can(PERMISSIONS.COMPANIONS_EDIT_ANY);
  const canEditAppointments = can(PERMISSIONS.APPOINTMENTS_EDIT_ANY);
  const canEditTasks = can(PERMISSIONS.TASKS_EDIT_ANY);
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

  return (
    <div className="flex flex-col gap-4 pl-3! pr-3! pt-3! pb-3! md:pl-5! md:pr-5! md:pt-5! md:pb-5! lg:pl-5! lg:pr-5! lg:pt-5! lg:pb-5!">
      <div className="flex justify-between items-center w-full flex-wrap gap-2">
        <div className="flex flex-col gap-1">
          <div className="text-text-primary text-heading-1 flex items-center gap-2">
            <span>
              {'Companions'}
              <span className="text-text-tertiary">{` (${companions.length})`}</span>
            </span>
            <GlassTooltip
              content="View companion and parent details, access their documents, and jump into related tasks or appointments without leaving the profile."
              side="bottom"
            >
              <button
                type="button"
                aria-label="Companions info"
                className="relative top-[3px] inline-flex h-5 w-5 shrink-0 items-center justify-center leading-none text-text-secondary hover:text-text-primary transition-colors"
              >
                <IoInformationCircleOutline size={20} />
              </button>
            </GlassTooltip>
          </div>
        </div>
        {canEditCompanions && (
          <Primary href="#" onClick={() => setAddPopup((e) => !e)} text="Add" />
        )}
      </div>
      <PermissionGate allOf={[PERMISSIONS.COMPANIONS_VIEW_ANY]} fallback={<Fallback />}>
        <div className="w-full flex flex-col gap-3">
          <Filters
            filterOptions={CompanionsSpeciesFilters}
            statusOptions={CompanionsStatusFilters}
            activeFilter={activeFilter}
            activeStatus={activeStatus}
            setActiveFilter={setActiveFilter}
            setActiveStatus={setActiveStatus}
          />
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
        {activeCompanion && canEditCompanions && (
          <ChangeCompanionStatus
            showModal={changeStatusPopup}
            setShowModal={setChangeStatusPopup}
            activeCompanion={activeCompanion}
          />
        )}
        {canEditAppointments && activeCompanion && (
          <BookAppointment
            showModal={bookAppointment}
            setShowModal={setBookAppointment}
            activeCompanion={activeCompanion}
          />
        )}
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
    <ProtectedRoute>
      <OrgGuard>
        <Companions />
      </OrgGuard>
    </ProtectedRoute>
  );
};

export default ProtectedCompanions;
