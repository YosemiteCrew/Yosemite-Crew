"use client";
import React, { useState, useEffect } from "react";
import ProtectedRoute from "@/app/components/ProtectedRoute";
import { Primary } from "@/app/components/Buttons";
import CompanionFilters from "@/app/components/Filters/CompanionFilters";
import CompanionsTable from "@/app/components/DataTable/CompanionsTable";
import AddCompanion from "@/app/components/AddCompanion";
import CompanionInfo from "@/app/components/CompanionInfo";
import OrgGuard from "@/app/components/OrgGuard";
import { useCompanionsParentsForPrimaryOrg } from "@/app/hooks/useCompanion";
import { CompanionParent } from "./types";
import BookAppointment from "./BookAppointment";
import AddTask from "./AddTask";

const Companions = () => {
  const companions = useCompanionsParentsForPrimaryOrg();
  const [filteredList, setFilteredList] =
    useState<CompanionParent[]>(companions);
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
          (s) => s.companion.id === prev.companion.id
        );
        if (updated) return updated;
      }
      return companions[0];
    });
  }, [companions]);

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
        <Primary
          href="#"
          onClick={() => setAddPopup((e) => !e)}
          text="Add"
        />
      </div>
      <div className="w-full flex flex-col gap-3">
        <CompanionFilters list={companions} setFilteredList={setFilteredList} />
        <CompanionsTable
          filteredList={filteredList}
          activeCompanion={activeCompanion}
          setActiveCompanion={setActiveCompanion}
          setViewCompanion={setViewCompanion}
          setBookAppointment={setBookAppointment}
          setAddTask={setAddTask}
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
      {activeCompanion && (
        <BookAppointment
          showModal={bookAppointment}
          setShowModal={setBookAppointment}
          activeCompanion={activeCompanion}
        />
      )}
      {activeCompanion && (
        <AddTask
          showModal={addTask}
          setShowModal={setAddTask}
        />
      )}
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
