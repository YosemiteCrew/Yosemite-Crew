import {
  FormsCategory,
  FormsCategoryOptions,
  FormsProps,
  FormsStatus,
  FormsStatusFilters,
} from "@/app/features/forms/types/forms";
import React, { useEffect, useMemo, useState } from "react";
import LabelDropdown from "@/app/ui/inputs/Dropdown/LabelDropdown";
import { getStatusStyle as getFormsStatusStyle } from "@/app/ui/tables/FormsTable";
import { useOrgStore } from "@/app/stores/orgStore";
import { Organisation } from "@yosemite-crew/types";

type FormsFiltersProps = {
  list: FormsProps[];
  setFilteredList: any;
  searchQuery?: string;
};

const FormsFilters = ({ list, setFilteredList, searchQuery = "" }: FormsFiltersProps) => {
  const [activeStatus, setActiveStatus] = useState<FormsStatus | "All">("All");
  const [activeCategory, setActiveCategory] = useState<FormsCategory | "All">(
    "All"
  );

  const orgType = useOrgStore((s) =>
    s.primaryOrgId ? s.orgsById[s.primaryOrgId]?.type : undefined,
  );
  const orgTypeOverride = process.env.NEXT_PUBLIC_ORG_TYPE_OVERRIDE as Organisation["type"] | undefined;
  const effectiveOrgType = orgTypeOverride || orgType;

  const filteredCategoryOptions = useMemo(() => {
    const base = new Set(["Consent form", "Discharge", "Custom"]);
    const allowed = (() => {
      if (effectiveOrgType === "HOSPITAL") {
        return FormsCategoryOptions.filter(
          (c) => base.has(c) || c.startsWith("SOAP")
        );
      }
      if (effectiveOrgType === "BOARDER") {
        return FormsCategoryOptions.filter(
          (c) => base.has(c) || c.startsWith("Boarder")
        );
      }
      if (effectiveOrgType === "BREEDER") {
        return FormsCategoryOptions.filter(
          (c) => base.has(c) || c.startsWith("Breeder")
        );
      }
      if (effectiveOrgType === "GROOMER") {
        return FormsCategoryOptions.filter(
          (c) => base.has(c) || c.startsWith("Groomer")
        );
      }
      return FormsCategoryOptions;
    })();

    return ["All", ...allowed].map((cat) => ({ label: cat, value: cat }));
  }, [effectiveOrgType]);

  useEffect(() => {
    const allowedValues = new Set(filteredCategoryOptions.map((opt) => opt.value));
    if (!allowedValues.has(activeCategory)) {
      setActiveCategory("All");
    }
  }, [filteredCategoryOptions, activeCategory]);

  const filteredList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return list.filter((item) => {
      const matchesStatus =
        activeStatus === "All" || item.status === activeStatus;
      const matchesCategory =
        activeCategory === "All" || item.category === activeCategory;
      const matchesQuery =
        !q ||
        item.name?.toLowerCase().includes(q) ||
        item.category?.toLowerCase().includes(q);
      return matchesStatus && matchesCategory && matchesQuery;
    });
  }, [list, activeCategory, activeStatus, searchQuery]);

  useEffect(() => {
    setFilteredList(filteredList);
  }, [filteredList, setFilteredList]);

  return (
    <div className="w-full flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        {FormsStatusFilters.map((status) => {
          const active = status === activeStatus;
          const statusStyle =
            status === "All"
              ? { color: "#EAF3FF", backgroundColor: "#247AED" }
              : getFormsStatusStyle(status || "");

          return (
            <button
              key={status}
              onClick={() => setActiveStatus(status)}
              className="min-w-20 text-body-4 px-3 py-[6px] rounded-2xl! border border-card-border! transition-all duration-300 hover:bg-card-hover hover:border-card-hover! text-text-tertiary"
              style={active ? statusStyle : undefined}
            >
              {status}
            </button>
          );
        })}
      </div>
      <div className="w-full sm:w-[220px] min-w-[180px]">
        <LabelDropdown
          placeholder="Category"
          options={filteredCategoryOptions}
          defaultOption={activeCategory}
          onSelect={(option) => {
            setActiveCategory(option.value as FormsCategory | "All");
          }}
        />
      </div>
    </div>
  );
};

export default FormsFilters;
