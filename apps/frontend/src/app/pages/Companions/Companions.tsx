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

const Companions = () => {
  const companions = useCompanionsParentsForPrimaryOrg();
  const [filteredList, setFilteredList] =
    useState<CompanionParent[]>(companions);
  const [addPopup, setAddPopup] = useState(false);
  const [viewCompanion, setViewCompanion] = useState(false);
  const [activeCompanion, setActiveCompanion] =
    useState<CompanionParent | null>(companions[0] ?? null);
  const [bookAppointment, setBookAppointment] = useState(false);

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
    <div className="flex flex-col gap-8 lg:gap-20 px-4! py-6! md:px-12! md:py-10! lg:px-10! lg:pb-20! lg:pr-20!">
      <div className="flex justify-between items-center w-full">
        <div className="font-grotesk font-medium text-black-text text-[33px]">
          Companions
        </div>
        <Primary
          href="#"
          onClick={() => setAddPopup((e) => !e)}
          text="Add"
          classname="w-[140px] sm:w-40"
        />
      </div>
      <div className="w-full flex flex-col gap-6">
        <CompanionFilters list={companions} setFilteredList={setFilteredList} />
        <CompanionsTable
          filteredList={filteredList}
          activeCompanion={activeCompanion}
          setActiveCompanion={setActiveCompanion}
          setViewCompanion={setViewCompanion}
          setBookAppointment={setBookAppointment}
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
