"use client";
import React from "react";
import CardHeader from "../CardHeader/CardHeader";

import { useExploreMetrics } from "@/app/hooks/useMetrics";
import { DashboardSummary } from "@/app/types/metrics";

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
    <div className="flex flex-col w-full gap-3">
      <CardHeader
        title={"Explore"}
        options={["Last week", "Last month", "Last 6 months", "Last 1 year"]}
      />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((stat) => (
          <div
            className="p-3 w-full rounded-2xl border border-card-border bg-white flex flex-col gap-1"
            key={stat.name}
          >
            <div className="text-body-3 text-text-tertiary">{stat.name}</div>
            <div className="text-heading-1 text-text-primary">{stat.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Explorecard;
