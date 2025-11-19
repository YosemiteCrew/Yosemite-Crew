"use client";
import React, { useState, useRef, useEffect } from "react";
import ProtectedRoute from "@/app/components/ProtectedRoute";
import { Primary } from "@/app/components/Buttons";
import CompanionFilters from "@/app/components/Filters/CompanionFilters";
import CompanionsTable from "@/app/components/DataTable/CompanionsTable";
import { CompanionProps } from "@/app/pages/Companions/types";
import { demoData } from "./demo";
import AddCompanion from "@/app/components/AddCompanion";
import CompanionInfo from "@/app/components/CompanionInfo";

const Companions = () => {
  const [list, setList] = useState<CompanionProps[]>(demoData);
  const [filteredList, setFilteredList] = useState<CompanionProps[]>(demoData);
  const [isLoading, setIsLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting && !isLoading && filteredList.length > 0) {
          setIsLoading(true);
          setTimeout(() => {
            updateList();
            setIsLoading(false);
          }, 300);
        }
      },
      { threshold: 1 }
    );
    const currentSentinel = sentinelRef.current;
    if (currentSentinel) observer.observe(currentSentinel);
    return () => {
      if (currentSentinel) observer.unobserve(currentSentinel);
    };
  }, [isLoading, filteredList]);

  const updateList = () => {
    setList((prev) => [...prev, ...demoData]);
  };

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
        <div
          ref={sentinelRef}
          className="w-full h-10 flex justify-center items-center"
        >
          {isLoading && (
            <span className="text-gray-500 text-sm">
              Loading more companions...
            </span>
          )}
        </div>
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
