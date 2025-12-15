import React, { useEffect, useMemo, useState } from "react";
import Search from "../../Inputs/Search";
import { InvoiceProps } from "@/app/types/invoice";

const Category = [
  {
    name: "All",
    key: "all",
  },
];

const Statuses = [
  {
    name: "All",
    key: "all",
    bg: "#fff",
    text: "#302f2e",
  },
  {
    name: "Draft",
    key: "draft",
    bg: "#FEF3E9",
    text: "#F68523",
  },
  {
    name: "Open",
    key: "open",
    bg: "#EAF3FF",
    text: "#247AED",
  },
  {
    name: "Paid",
    key: "paid",
    bg: "#E6F4EF",
    text: "#54B492",
  },
  {
    name: "Uncollectible",
    key: "uncollectible",
    bg: "#FDEBEA",
    text: "#EA3729",
  },
  {
    name: "Deleted",
    key: "deleted",
    bg: "#FDEBEA",
    text: "#EA3729",
  },
  {
    name: "Void",
    key: "void",
    bg: "#EAEAEA",
    text: "#302F2E",
  },
];

type InvoicesFiltersProps = {
  list: InvoiceProps[];
  setFilteredList: React.Dispatch<React.SetStateAction<InvoiceProps[]>>;
};

const InvoicesFilters = ({ list, setFilteredList }: InvoicesFiltersProps) => {
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeStatus, setActiveStatus] = useState("all");
  const [search, setSearch] = useState("");

  const filteredList = useMemo(() => {
    return list.filter((item: InvoiceProps) => {
      const matchesStatus =
        activeStatus === "all" ||
        item.status.toLowerCase() === activeStatus.toLowerCase();
      const matchesCategory = activeCategory === "all";
      const matchesSearch =
        item.metadata.pet.toLowerCase().includes(search.toLowerCase()) ||
        item.metadata.parent.toLowerCase().includes(search.toLowerCase());
      return matchesStatus && matchesCategory && matchesSearch;
    });
  }, [list, activeCategory, activeStatus, search]);

  useEffect(() => {
    setFilteredList(filteredList);
  }, [filteredList, setFilteredList]);

  return (
    <div className="w-full flex items-center justify-between flex-wrap gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {Category.map((category) => (
            <button
              key={category.key}
              onClick={() => setActiveCategory(category.key)}
              className={`px-3 h-9 rounded-xl! border font-satoshi! text-[15px]! font-bold hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] ${category.key === activeCategory ? "border-blue-text! bg-blue-light! text-blue-text! shadow-[0_0_8px_0_rgba(0,0,0,0.16)]" : "border-[#302f2e]!"}`}
            >
              {category.name}
            </button>
          ))}
        </div>
        <div className="flex">
          <Search value={search} setSearch={setSearch} />
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {Statuses.map((status) => (
          <button
            key={status.key}
            className={`px-3 h-9 rounded-xl! font-satoshi! text-[15px]! font-bold hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] ${status.key === activeStatus ? "border! shadow-[0_0_8px_0_rgba(0,0,0,0.16)]" : "border-0!"}`}
            style={{
              background: status.bg,
              color: status.text,
              borderColor:
                status.key === activeStatus ? status.text : status.bg,
            }}
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
