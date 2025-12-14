import React, { useEffect, useMemo } from "react";
import { InventoryFiltersState } from "@/app/pages/Inventory/types";
import Search from "../../Inputs/Search";
import Dropdown from "../../Inputs/Dropdown/Dropdown";

const Statuses = [
  { name: "All", key: "ALL", bg: "#F7F7F7", text: "#302F2E" },
  { name: "Active", key: "ACTIVE", bg: "#E6F4EF", text: "#54B492" },
  { name: "Hidden", key: "HIDDEN", bg: "#EAEAEA", text: "#302F2E" },
  { name: "Low stock", key: "LOW_STOCK", bg: "#FEF3E9", text: "#F68523" },
  { name: "Expired", key: "EXPIRED", bg: "#FDEBEA", text: "#EA3729" },
  { name: "Expiring soon", key: "EXPIRING_SOON", bg: "#FEF7E5", text: "#C47F00" },
  { name: "Healthy", key: "HEALTHY", bg: "#EAF3FF", text: "#247AED" },
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
    <div className="w-full flex flex-col gap-3 min-[1520px]:flex-row min-[1520px]:items-center min-[1520px]:justify-between">
      <div className="flex items-center gap-3 flex-1 flex-wrap">
        <div className="min-w-[220px]">
          <Dropdown
            placeholder="Category"
            value={filters.category}
            onChange={(val: string) => updateFilters({ category: val })}
            options={categoryOptions}
            className="min-h-12!"
            dropdownClassName="top-[55px]! !h-fit"
            disabled={loading}
          />
        </div>
        <Search
          value={filters.search}
          setSearch={(value: string) => updateFilters({ search: value })}
        />
      </div>
      <div className="flex items-center gap-2 flex-wrap md:justify-start min-[1520px]:justify-end">
        {Statuses.map((status) => (
          <button
            key={status.key}
            disabled={loading}
            className={`px-3 h-12 rounded-xl! font-satoshi! text-[15px]! font-bold hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] ${status.key === filters.status ? "border! shadow-[0_0_8px_0_rgba(0,0,0,0.16)]" : "border-0!"} ${loading ? "opacity-70 cursor-not-allowed" : ""}`}
            style={{
              background: status.bg,
              color: status.text,
              borderColor:
                status.key === filters.status ? status.text : status.bg,
            }}
            onClick={() => updateFilters({ status: status.key })}
          >
            {status.name}
          </button>
        ))}
      </div>
    </div>
  );
};

export default InventoryFilters;
