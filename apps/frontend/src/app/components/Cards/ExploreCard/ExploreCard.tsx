"use client"
import React from "react";
import CardHeader from "../CardHeader/CardHeader";

import { useExploreMetrics } from "@/app/hooks/useMetrics";
import { DashboardSummary } from "@/app/types/metrics";

import "./ExploreCard.css";

const getExploreStats = (metrics: DashboardSummary) => [
  {
    name: "Revenue",
    value: `$${metrics.revenue}`,
  },
  {
    name: "Appointments",
    value: metrics.appointments.toString(),
  },
  {
    name: "Tasks",
    value: metrics.tasks.toString(),
  },
  {
    name: "Staff on duty",
    value: metrics.staffOnDuty.toString(),
  },
];

const Explorecard = () => {
  const metrics = useExploreMetrics();
  const stats = getExploreStats(metrics);

  return (
    <div className="explore-container">
      <CardHeader
        title={"Explore"}
        options={["Last week", "Last month", "Last 6 months", "Last 1 year"]}
      />
      <div className="explore-cards">
        {stats.map((stat) => (
          <div className="explore-stat" key={stat.name}>
            <div className="explore-stat-name">{stat.name}</div>
            <div className="explore-stat-value">{stat.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Explorecard;
