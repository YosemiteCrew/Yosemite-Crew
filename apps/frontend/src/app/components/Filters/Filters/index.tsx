import React from "react";
import { FilterOption, StatusOption } from "@/app/pages/Companions/types";

type FiltersProps = {
  filterOptions?: FilterOption[];
  statusOptions?: StatusOption[];
  activeFilter?: string;
  setActiveFilter?: (v: string) => void;
  activeStatus?: string;
  setActiveStatus?: (v: string) => void;
};

const Filters = ({
  filterOptions,
  statusOptions,
  activeFilter,
  setActiveFilter,
  activeStatus,
  setActiveStatus,
}: FiltersProps) => {
  return (
    <div className="w-full flex items-center justify-between flex-wrap gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        {filterOptions?.map((filter) => (
          <button
            key={filter.key}
            onClick={() => setActiveFilter?.(filter.key)}
            className={`min-w-20 text-body-4 px-3 py-[5px] text-text-tertiary rounded-2xl! transition-all duration-300 ${filter.key === activeFilter ? " bg-blue-light text-blue-text! border-text-brand! border" : "border border-card-border! hover:bg-card-hover!"}`}
          >
            {filter.name}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {statusOptions?.map((status) => (
          <button
            key={status.key}
            className={`min-w-20 text-body-4 px-3 py-[6px] rounded-2xl! border border-card-border! transition-all duration-300 hover:bg-card-hover hover:border-card-hover!`}
            style={
              status.key === activeStatus
                ? {
                    background: status.bg,
                    color: status.text,
                  }
                : {}
            }
            onClick={() => setActiveStatus?.(status.key)}
          >
            {status.name}
          </button>
        ))}
      </div>
    </div>
  );
};

export default Filters;
