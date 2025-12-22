"use client";
import React, { useEffect, useState } from "react";
import ProtectedRoute from "@/app/components/ProtectedRoute";
import InvoicesFilters from "@/app/components/Filters/InvoicesFilers";
import InvoiceDataTable from "@/app/components/DataTable/InvoiceTable";
import InvoiceInfo from "./Sections/InvoiceInfo";
import OrgGuard from "@/app/components/OrgGuard";
import { useInvoicesForPrimaryOrg, useLoadInvoicesForPrimaryOrg } from "@/app/hooks/useInvoices";
import { Invoice } from "@yosemite-crew/types";

const Finance = () => {
  useLoadInvoicesForPrimaryOrg()
  
  const invoices = useInvoicesForPrimaryOrg();
  const [filteredList, setFilteredList] = useState<Invoice[]>(invoices);
  const [viewInvoice, setViewInvoice] = useState(false);
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(
    invoices[0] || null
  );

  useEffect(() => {
    setActiveInvoice((prev) => {
      if (invoices.length === 0) return null;
      if (prev?.id) {
        const updated = invoices.find((s) => s.id === prev.id);
        if (updated) return updated;
      }
      return invoices[0];
    });
  }, [invoices]);

  return (
    <div className="flex flex-col gap-8 lg:gap-20 px-4! py-6! md:px-12! md:py-10! lg:px-10! lg:pb-20! lg:pr-20!">
      <div className="flex justify-between items-center w-full">
        <div className="font-grotesk font-medium text-black-text text-[33px]">
          Finance
        </div>
      </div>

      <div className="w-full flex flex-col gap-6">
        <InvoicesFilters list={invoices} setFilteredList={setFilteredList} />
        <InvoiceDataTable
          setActiveInvoice={setActiveInvoice}
          setViewInvoice={setViewInvoice}
          filteredList={filteredList}
        />
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
      <OrgGuard>
        <Finance />
      </OrgGuard>
    </ProtectedRoute>
  );
};

export default ProtectedFinance;
