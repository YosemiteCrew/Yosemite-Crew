import { useEffect, useMemo } from "react";
import { useOrgStore } from "../stores/orgStore";
import { loadInvoicesForOrgPrimaryOrg } from "../services/invoiceService";
import { Invoice } from "@yosemite-crew/types";
import { useInvoiceStore } from "../stores/invoiceStore";

export const useLoadInvoicesForPrimaryOrg = () => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);

  useEffect(() => {
    if (!primaryOrgId) return;
    void loadInvoicesForOrgPrimaryOrg({ force: true });
  }, [primaryOrgId]);
};

export const useInvoicesForPrimaryOrg = (): Invoice[] => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const invoicesById = useInvoiceStore((s) => s.invoicesById);

  const invoiceIdsByOrgId = useInvoiceStore((s) => s.invoiceIdsByOrgId);

  return useMemo(() => {
    if (!primaryOrgId) return [];
    const ids = invoiceIdsByOrgId[primaryOrgId] ?? [];
    return ids.map((id) => invoicesById[id]).filter(Boolean);
  }, [primaryOrgId, invoicesById, invoiceIdsByOrgId]);
};
