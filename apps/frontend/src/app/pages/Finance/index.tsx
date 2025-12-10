"use client";
import React, { useEffect, useRef, useState } from "react";
import ProtectedRoute from "@/app/components/ProtectedRoute";
import InvoicesFilters from "@/app/components/Filters/InvoicesFilers";
import { InvoiceProps } from "@/app/types/invoice";
import InvoiceDataTable from "@/app/components/DataTable/InvoiceTable";
import { demoInvoices } from "./demo";
import InvoiceInfo from "./Sections/InvoiceInfo";

const Finance = () => {
  const [list, setList] = useState<InvoiceProps[]>(demoInvoices);
  const [filteredList, setFilteredList] =
    useState<InvoiceProps[]>(demoInvoices);
  const [viewInvoice, setViewInvoice] = useState(false);
  const [activeInvoice, setActiveInvoice] = useState<InvoiceProps | null>(
    demoInvoices[0] || null
  );
  const [isLoading, setIsLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (filteredList.length > 0) {
      setActiveInvoice(filteredList[0]);
    } else {
      setActiveInvoice(null);
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
    setList((prev) => [...prev, ...demoInvoices]);
  };

  return (
    <div className="flex flex-col gap-8 lg:gap-20 px-4! py-6! md:px-12! md:py-10! lg:px-10! lg:pb-20! lg:pr-20!">
      <div className="flex justify-between items-center w-full">
        <div className="font-grotesk font-medium text-black-text text-[33px]">
          Finance
        </div>
      </div>

      <div className="w-full flex flex-col gap-6">
        <InvoicesFilters list={list} setFilteredList={setFilteredList} />
        <InvoiceDataTable
          setActiveInvoice={setActiveInvoice}
          setViewInvoice={setViewInvoice}
          filteredList={filteredList}
        />
        <div
          ref={sentinelRef}
          className="w-full h-10 flex justify-center items-center"
        >
          {isLoading && (
            <span className="text-gray-500 text-sm">
              Loading more invoices...
            </span>
          )}
        </div>
      </div>
      {activeInvoice && (
        <InvoiceInfo
          showModal={viewInvoice}
          setShowModal={setViewInvoice}
          activeInvoice={activeInvoice}
        />
      )}
    </div>
  );
};

const ProtectedFinance = () => {
  return (
    <ProtectedRoute>
      <Finance />
    </ProtectedRoute>
  );
};

export default ProtectedFinance;
