"use client";
import React, { useMemo, useState } from "react";
import AvailabilityTable from "../DataTable/AvailabilityTable";
import Link from "next/link";
import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";

import "./Summary.css";

const AvailabilityLabels = [
  {
    name: "All",
    value: "all",
    background: "#fff",
    color: "#302f2e",
  },
  {
    name: "Available",
    value: "available",
    background: "#E6F4EF",
    color: "#008F5D",
  },
  {
    name: "Consulting",
    value: "consulting",
    background: "#EAF3FF",
    color: "#247AED",
  },

  {
    name: "Off-Duty",
    value: "off-duty",
    background: "#EAEAEA",
    color: "#302F2E",
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
      <div className="summary-title">
        Availability&nbsp;<span>({teams.length})</span>
      </div>
      <div className="summary-labels-left">
        {AvailabilityLabels?.map((label, i) => (
          <button
            className={`summary-label-right hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] ${label.value === selectedLabel ? "border! shadow-[0_0_8px_0_rgba(0,0,0,0.16)]" : "border-0!"}`}
            key={label.name + i}
            style={{
              color: label.color,
              background: label.background,
              border: i === 0 ? "1px solid #302f2e" : "",
            }}
            onClick={() => setSelectedLabel(label.value)}
          >
            {label.name}
          </button>
        ))}
      </div>
      <AvailabilityTable filteredList={filteredList.slice(0, 5)} hideActions />
      <div className="see-all-button">
        <Link className="see-all-button-link" href={"/organization"}>
          See all
        </Link>
      </div>
    </div>
  );
};

export default Availability;
