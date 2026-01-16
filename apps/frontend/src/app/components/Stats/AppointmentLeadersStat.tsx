import React from "react";
import CardHeader from "../Cards/CardHeader/CardHeader";
import DynamicChartCard from "../DynamicChart/DynamicChartCard";

const blankData = [
  { month: "Mar", Completed: 0, Cancelled: 0 },
  { month: "Apr", Completed: 0, Cancelled: 0 },
  { month: "May", Completed: 0, Cancelled: 0 },
  { month: "Jun", Completed: 0, Cancelled: 0 },
  { month: "Jul", Completed: 0, Cancelled: 0 },
  { month: "Aug", Completed: 0, Cancelled: 0 },
];

const AppointmentLeadersStat = () => {
  return (
    <div className="flex flex-col gap-2">
      <CardHeader
        title={"Appointment leaders"}
        options={["Last week", "Last month", "Last 6 months", "Last 1 year"]}
      />
      <DynamicChartCard
        data={blankData}
        layout={"vertical"}
        keys={[
          { name: "Completed", color: "#111" },
          { name: "Cancelled", color: "#ccc" },
        ]}
        hideKeys={true}
      />
    </div>
  );
};

export default AppointmentLeadersStat;
