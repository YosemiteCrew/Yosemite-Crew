import React, { useEffect, useMemo, useState } from "react";
import { Invoice } from "@yosemite-crew/types";

const Statuses = [
  {
    name: "All",
    key: "all",
    bg: "#F1D4B0",
    text: "#000",
  },
  {
    name: "Pending",
    key: "pending",
    bg: "#747283",
    text: "#fff",
  },
  {
    name: "Awaiting payment",
    key: "awaiting_payment",
    bg: "#A8A181",
    text: "#fff",
  },
  {
    name: "Paid",
    key: "paid",
    bg: "#D28F9A",
    text: "#fff",
  },
  {
    name: "Failed",
    key: "failed",
    bg: "#5C614B",
    text: "#fff",
  },
  {
    name: "Cancelled",
    key: "cancelled",
    bg: "#D9A488",
    text: "#fff",
  },
  {
    name: "Refunded",
    key: "refunded",
    bg: "#BF9FAA",
    text: "#fff",
  },
];

type InvoicesFiltersProps = {
  list: Invoice[];
  setFilteredList: React.Dispatch<React.SetStateAction<Invoice[]>>;
};

const InvoicesFilters = ({ list, setFilteredList }: InvoicesFiltersProps) => {
  const [activeStatus, setActiveStatus] = useState("all");

  const filteredList = useMemo(() => {
    return list.filter((item: Invoice) => {
      const matchesStatus =
        activeStatus === "all" ||
        item.status.toLowerCase() === activeStatus.toLowerCase();
      return matchesStatus;
    });
  }, [list, activeStatus]);

  useEffect(() => {
    setFilteredList(filteredList);
  }, [filteredList, setFilteredList]);

  return (
    <div className="w-full flex items-center justify-between flex-wrap gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {Statuses.map((status) => (
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
            onClick={() => setActiveStatus(status.key)}
          >
            {status.name}
          </button>
        ))}
      </div>
    </div>
  );
};

export default InvoicesFilters;
