"use client";
import React, { useState, useEffect } from "react";
import ProtectedRoute from "@/app/components/ProtectedRoute";
import { Primary } from "@/app/components/Buttons";
import CompanionFilters from "@/app/components/Filters/CompanionFilters";
import CompanionsTable from "@/app/components/DataTable/CompanionsTable";
import { CompanionProps } from "@/app/pages/Companions/types";
import { demoData } from "./demo";
import AddCompanion from "@/app/components/AddCompanion";
import CompanionInfo from "@/app/components/CompanionInfo";

const Companions = () => {
  const [list] = useState<CompanionProps[]>(demoData);
  const [filteredList, setFilteredList] = useState<CompanionProps[]>(demoData);
  const [addPopup, setAddPopup] = useState(false);
  const [viewCompanion, setViewCompanion] = useState(false);
  const [activeCompanion, setActiveCompanion] = useState<CompanionProps | null>(
    demoData[0] ?? null
  );

  useEffect(() => {
    if (filteredList.length > 0) {
      setActiveCompanion(filteredList[0]);
    } else {
      setActiveCompanion(null);
    }
  }, [filteredList]);

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
        <CompanionFilters list={list} setFilteredList={setFilteredList} />
        <CompanionsTable
          filteredList={filteredList}
          activeCompanion={activeCompanion}
          setActiveCompanion={setActiveCompanion}
          setViewCompanion={setViewCompanion}
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
    </div>
  );
};

const ProtectedCompanions = () => {
  return (
    <ProtectedRoute>
      <Companions />
    </ProtectedRoute>
  );
};

export default ProtectedCompanions;
