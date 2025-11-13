"use client";
import React, { useState, useRef, useEffect } from "react";
import ProtectedRoute from "@/app/components/ProtectedRoute";
import { Primary } from "@/app/components/Buttons";
import CompanionFilters from "@/app/components/Filters/CompanionFilters/CompanionFilters";
import CompanionsTable from "@/app/components/DataTable/CompanionsTable";
import { CompanionProps } from "@/app/components/DataTable/types";
import { demoData } from "./demo";

import "./Companions.css";

const Companions = () => {
  const [list, setList] = useState<CompanionProps[]>(demoData);
  const [filteredList, setFilteredList] = useState<CompanionProps[]>(demoData);
  const [isLoading, setIsLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const [addPopup, setAddPopup] = useState(false);

  useEffect(() => {
    if (!addPopup) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setAddPopup(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [addPopup]);

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
    <div className="companion-container">
      <div className="flex justify-between items-center w-full">
        <div className="companion-heading">Companions</div>
        <Primary
          href="#"
          onClick={() => setAddPopup((e) => !e)}
          text="Add"
          classname="w-[140px] sm:w-40"
        />
      </div>
      <div className="w-full flex flex-col gap-6">
        <CompanionFilters list={list} setFilteredList={setFilteredList} />
        <CompanionsTable filteredList={filteredList} />
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

      <div
        ref={popupRef}
        className={`fixed top-20 right-0 h-[calc(100%-80px)] w-[90%] sm:w-[400px] bg-white border! border-grey-light! shadow-[0_0_32px_0_rgba(0,0,0,0.32)] rounded-l-2xl z-50 transition-transform duration-300 ease-in-out ${
          addPopup ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="px-4! py-8! flex flex-col h-full">
          <div className="flex justify-center w-full font-grotesk text-black-text font-medium text-[28px]">
            Add Companion
          </div>
        </div>
      </div>
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
