"use client";
import React, { useEffect, useRef, useState } from "react";
import ProtectedRoute from "@/app/components/ProtectedRoute";
import { Primary } from "@/app/components/Buttons";
import { FormsProps } from "@/app/types/forms";
import { demoForms } from "./demo";
import FormsFilters from "@/app/components/Filters/FormsFilters";
import FormsTable from "@/app/components/DataTable/FormsTable";
import AddForm from "./Sections/AddForm";
import FormInfo from "./Sections/FormInfo";

const Forms = () => {
  const [list, setList] = useState<FormsProps[]>(demoForms);
  const [filteredList, setFilteredList] = useState<FormsProps[]>(demoForms);
  const [isLoading, setIsLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [addPopup, setAddPopup] = useState(false);
  const [viewPopup, setViewPopup] = useState(false);
  const [activeForm, setActiveForm] = useState<FormsProps | null>(
    demoForms[0] ?? null
  );

  useEffect(() => {
    if (filteredList.length > 0) {
      setActiveForm(filteredList[0]);
    } else {
      setActiveForm(null);
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
    setList((prev) => [...prev, ...demoForms]);
  };

  return (
    <div className="flex flex-col gap-8 lg:gap-20 px-4! py-6! md:px-12! md:py-10! lg:px-10! lg:pb-20! lg:pr-20!">
      <div className="flex justify-between items-center w-full">
        <div className="font-grotesk font-medium text-black-text text-[33px]">
          Forms
        </div>
        <Primary
          href="#"
          text="Add"
          classname="w-[140px] sm:w-40"
          onClick={() => setAddPopup(true)}
        />
      </div>

      <div className="w-full flex flex-col gap-6">
        <FormsFilters list={list} setFilteredList={setFilteredList} />
        <FormsTable
          filteredList={filteredList}
          activeForm={activeForm}
          setActiveForm={setActiveForm}
          setViewPopup={setViewPopup}
        />
        <div
          ref={sentinelRef}
          className="w-full h-10 flex justify-center items-center"
        >
          {isLoading && (
            <span className="text-gray-500 text-sm">Loading more forms...</span>
          )}
        </div>
      </div>

      <AddForm showModal={addPopup} setShowModal={setAddPopup} />
      {activeForm && (
        <FormInfo
          showModal={viewPopup}
          setShowModal={setViewPopup}
          activeForm={activeForm}
        />
      )}
    </div>
  );
};

const ProtectedForms = () => {
  return (
    <ProtectedRoute>
      <Forms />
    </ProtectedRoute>
  );
};

export default ProtectedForms;
