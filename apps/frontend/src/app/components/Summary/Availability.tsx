"use client";
import React, { useState } from "react";
import AvailabilityTable from "../DataTable/AvailabilityTable";
import classNames from "classnames";
import Link from "next/link";

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
    name: "Off duty",
    value: "off",
    background: "#EAEAEA",
    color: "#302F2E",
  },
];

const Availability = () => {
  const [selectedLabel, setSelectedLabel] = useState("all");

  return (
    <div className="summary-container">
      <div className="summary-title">
        Availability&nbsp;<span>(55)</span>
      </div>
      <div className="summary-labels-left">
        {AvailabilityLabels?.map((label, i) => (
          <button
            className={classNames("summary-label-right", {
              "active-label-availability": selectedLabel === label.value,
            })}
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
      <AvailabilityTable />
      <div className="see-all-button">
        <Link className="see-all-button-link" href={"/organisations"}>
          See all
        </Link>
      </div>
    </div>
  );
};

export default Availability;
