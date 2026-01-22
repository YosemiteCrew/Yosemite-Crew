"use client";
import React, { useEffect, useMemo, useState } from "react";
import ProtectedRoute from "@/app/components/ProtectedRoute";
import InvoiceDataTable from "@/app/components/DataTable/InvoiceTable";
import InvoiceInfo from "./Sections/InvoiceInfo";
import OrgGuard from "@/app/components/OrgGuard";
import {
  useInvoicesForPrimaryOrg,
  useLoadInvoicesForPrimaryOrg,
} from "@/app/hooks/useInvoices";
import { Invoice } from "@yosemite-crew/types";
import Filters from "@/app/components/Filters/Filters";
import { InvoiceStatusFilters } from "@/app/types/invoice";
import { useSearchStore } from "@/app/stores/searchStore";
import { PermissionGate } from "@/app/components/PermissionGate";
import { PERMISSIONS } from "@/app/utils/permissions";
import Fallback from "@/app/components/Fallback";

const Finance = () => {
  useLoadInvoicesForPrimaryOrg();

  const invoices = useInvoicesForPrimaryOrg();
  const query = useSearchStore((s) => s.query);
  const [activeStatus, setActiveStatus] = useState("all");
  const [viewInvoice, setViewInvoice] = useState(false);
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(
    invoices[0] || null,
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

  const filteredList = useMemo(() => {
    const q = query.trim().toLowerCase();
    const statusWanted = activeStatus.toLowerCase();

    return invoices.filter((item) => {
      const status = item.status?.toLowerCase();
      const matchesStatus = statusWanted === "all" || status === statusWanted;
      const matchesQuery = !q || item.appointmentId?.toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [invoices, activeStatus, query]);

  return (
    <div className="flex flex-col gap-6 px-3! py-3! sm:px-12! lg:px-[60px]! sm:py-12!">
      <div className="flex justify-between items-center w-full flex-wrap gap-2">
        <div className="flex flex-col gap-1">
          <div className="text-text-primary text-heading-1">
            Finance{""}
            <span className="text-text-tertiary">
              {" (" + invoices.length + ")"}
            </span>
          </div>
          <p className="text-body-3 text-text-secondary max-w-3xl">
            Review invoices, monitor payment status, and open each record to see
            billed services, balances, and payment history.
          </p>
        </div>
      </div>

      <PermissionGate allOf={[PERMISSIONS.BILLING_VIEW_ANY]} fallback={<Fallback />}>
        <div className="w-full flex flex-col gap-3">
          <Filters
            statusOptions={InvoiceStatusFilters}
            activeStatus={activeStatus}
            setActiveStatus={setActiveStatus}
          />
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
      </PermissionGate>
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
