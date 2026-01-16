"use client";
import React, { useMemo, useState } from "react";
import AvailabilityTable from "../DataTable/AvailabilityTable";
import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";

import "./Summary.css";

const AvailabilityLabels = [
  {
    name: "All",
    value: "all",
    background: "#6b72801a",
    color: "#302f2e",
  },
  {
    name: "Available",
    value: "available",
    background: "#E6F4EF",
    color: "#54B492",
  },
  {
    name: "Consulting",
    value: "consulting",
    background: "#FDEBEA",
    color: "#EA3729",
  },
  {
    name: "Requested",
    value: "requested",
    background: "#eaeaea",
    color: "#302f2e",
  },
  {
    name: "Off-Duty",
    value: "off-duty",
    background: "#FEF3E9",
    color: "#F68523",
  },
];

const Availability = () => {
  const teams = useTeamForPrimaryOrg();
  const [selectedLabel, setSelectedLabel] = useState("all");

  const filteredList = useMemo(() => {
    return teams.filter((item) => {
      const matchesStatus =
        selectedLabel === "all" ||
        item.status.toLowerCase() === selectedLabel.toLowerCase();
      return matchesStatus;
    });
  }, [teams, selectedLabel]);

  return (
    <div className="summary-container">
      <div className="text-text-primary text-heading-1">
        Availability&nbsp;<span className="text-text-tertiary">({teams.length})</span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {AvailabilityLabels?.map((label, i) => (
          <button
            key={label.name + i}
            className={`min-w-20 text-body-4 px-3 py-[6px] rounded-2xl! border border-card-border! transition-all duration-300 hover:bg-card-hover hover:border-card-hover!`}
            style={
              label.value === selectedLabel
                ? {
                    background: label.background,
                    color: label.color,
                  }
                : {}
            }
            onClick={() => setSelectedLabel(label.value)}
          >
            {label.name}
          </button>
        ))}
      </div>
      <AvailabilityTable filteredList={filteredList} />
    </div>
  );
};

export default Availability;
