import React, { useEffect, useMemo } from "react";
import { InventoryFiltersState } from "@/app/pages/Inventory/types";
import LabelDropdown from "../../Inputs/Dropdown/LabelDropdown";

// Colors match getStatusBadgeStyle in utils.ts for consistency with table badges
const Statuses = [
  { name: "All", key: "ALL", bg: "#247AED", text: "#EAF3FF" },
  { name: "Active", key: "ACTIVE", bg: "#F1D4B0", text: "#302f2e" },
  { name: "Hidden", key: "HIDDEN", bg: "#A8A181", text: "#F7F7F7" },
  { name: "Low stock", key: "LOW_STOCK", bg: "#BF9FAA", text: "#F7F7F7" },
  { name: "Expired", key: "EXPIRED", bg: "#D28F9A", text: "#F7F7F7" },
  { name: "Expiring soon", key: "EXPIRING_SOON", bg: "#5C614B", text: "#F7F7F7" },
  { name: "Healthy", key: "HEALTHY", bg: "#D9A488", text: "#F7F7F7" },
];

type InventoryFiltersProps = {
  filters: InventoryFiltersState;
  onChange: (filters: InventoryFiltersState) => void;
  categories: string[];
  loading?: boolean;
};

const InventoryFilters = ({
  filters,
  onChange,
  categories,
  loading = false,
}: InventoryFiltersProps) => {
  const categoryOptions = useMemo(
    () =>
      ["all", ...categories].map((cat) => ({
        label: cat === "all" ? "All categories" : cat,
        value: cat,
      })),
    [categories]
  );

  useEffect(() => {
    if (filters.category !== "all" && !categories.includes(filters.category)) {
      onChange({ ...filters, category: "all" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  const updateFilters = (patch: Partial<InventoryFiltersState>) => {
    onChange({ ...filters, ...patch });
  };

  return (
    <div className="w-full flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        {Statuses.map((status) => (
          <button
            key={status.key}
            disabled={loading}
            onClick={() => updateFilters({ status: status.key })}
            className="min-w-20 text-body-4 px-3 py-[6px] rounded-2xl! border border-card-border! transition-all duration-300 hover:bg-card-hover hover:border-card-hover! text-text-tertiary"
            style={
              status.key === filters.status
                ? {
                    backgroundColor: status.bg,
                    color: status.text,
                  }
                : undefined
            }
          >
            {status.name}
          </button>
        ))}
      </div>
      <div className="w-full sm:w-[220px] min-w-[180px]">
        <LabelDropdown
          placeholder="Category"
          options={categoryOptions}
          defaultOption={filters.category}
          onSelect={(option) => updateFilters({ category: option.value })}
        />
      </div>
    </div>
  );
};

export default InventoryFilters;
