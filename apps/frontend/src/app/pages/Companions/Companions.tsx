"use client";
import React, { useState, useEffect, useMemo } from "react";
import ProtectedRoute from "@/app/components/ProtectedRoute";
import { Primary } from "@/app/components/Buttons";
import Filters from "@/app/components/Filters/Filters";
import CompanionsTable from "@/app/components/DataTable/CompanionsTable";
import AddCompanion from "@/app/components/AddCompanion";
import CompanionInfo from "@/app/components/CompanionInfo";
import OrgGuard from "@/app/components/OrgGuard";
import { useCompanionsParentsForPrimaryOrg } from "@/app/hooks/useCompanion";
import {
  CompanionParent,
  CompanionsSpeciesFilters,
  CompanionsStatusFilters,
} from "./types";
import BookAppointment from "./BookAppointment";
import AddTask from "./AddTask";
import { useSearchStore } from "@/app/stores/searchStore";
import { PermissionGate } from "@/app/components/PermissionGate";
import { PERMISSIONS } from "@/app/utils/permissions";
import Fallback from "@/app/components/Fallback";
import { usePermissions } from "@/app/hooks/usePermissions";

const Companions = () => {
  const companions = useCompanionsParentsForPrimaryOrg();
  const { can } = usePermissions();
  const canEditCompanions = can(PERMISSIONS.COMMUNICATION_EDIT_ANY);
  const canEditAppointments = can(PERMISSIONS.APPOINTMENTS_EDIT_ANY);
  const canEditTasks = can(PERMISSIONS.TASKS_EDIT_ANY);
  const query = useSearchStore((s) => s.query);
  const [activeFilter, setActiveFilter] = useState("all");
  const [activeStatus, setActiveStatus] = useState("all");
  const [addPopup, setAddPopup] = useState(false);
  const [viewCompanion, setViewCompanion] = useState(false);
  const [activeCompanion, setActiveCompanion] =
    useState<CompanionParent | null>(companions[0] ?? null);
  const [bookAppointment, setBookAppointment] = useState(false);
  const [addTask, setAddTask] = useState(false);

  useEffect(() => {
    setActiveCompanion((prev) => {
      if (companions.length === 0) return null;
      if (prev?.companion.id) {
        const updated = companions.find(
          (s) => s.companion.id === prev.companion.id,
        );
        if (updated) return updated;
      }
      return companions[0];
    });
  }, [companions]);

  const filteredList = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filterWanted = activeFilter.toLowerCase();
    const statusWanted = activeStatus.toLowerCase();

    return companions.filter((item) => {
      const status = item.companion.status?.toLowerCase() ?? "inactive";
      const filter = item.companion.type?.toLowerCase() ?? "";

      const matchesStatus = statusWanted === "all" || status === statusWanted;
      const matchesFilter = filterWanted === "all" || filter === filterWanted;
      const matchesQuery = !q || item.companion.name?.toLowerCase().includes(q);

      return matchesStatus && matchesFilter && matchesQuery;
    });
  }, [companions, activeStatus, activeFilter, query]);

  return (
    <div className="flex flex-col gap-6 px-3! py-3! sm:px-12! lg:px-[60px]! sm:py-12!">
      <div className="flex justify-between items-center w-full flex-wrap gap-2">
        <div className="flex flex-col gap-1">
          <div className="text-text-primary text-heading-1">
            Companions{""}
            <span className="text-text-tertiary">
              {" (" + companions.length + ")"}
            </span>
          </div>
          <p className="text-body-3 text-text-secondary max-w-3xl">
            View companion and parent details, access their documents, and jump
            into related tasks or appointments without leaving the profile.
          </p>
        </div>
        {canEditCompanions && (
          <Primary href="#" onClick={() => setAddPopup((e) => !e)} text="Add" />
        )}
      </div>
      <PermissionGate
        allOf={[PERMISSIONS.COMPANIONS_VIEW_ANY]}
        fallback={<Fallback />}
      >
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
            activeCompanion={activeCompanion}
            setActiveCompanion={setActiveCompanion}
            setViewCompanion={setViewCompanion}
            setBookAppointment={setBookAppointment}
            setAddTask={setAddTask}
            canEditAppointments={canEditAppointments}
            canEditTasks={canEditTasks}
          />
        </div>

        <AddCompanion showModal={addPopup} setShowModal={setAddPopup} />
        {activeCompanion && (
          <CompanionInfo
            showModal={viewCompanion}
            setShowModal={setViewCompanion}
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
