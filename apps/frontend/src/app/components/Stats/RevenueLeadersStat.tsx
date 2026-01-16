import React from "react";
import CardHeader from "../Cards/CardHeader/CardHeader";

const RevenueLeadersStat = () => {
  return (
    <div className="flex flex-col gap-2">
      <CardHeader
        title={"Revenue leaders"}
        options={["Last week", "Last month", "Last 6 months", "Last 1 year"]}
      />
      <div className="bg-white border border-card-border p-3 flex flex-col gap-2 rounded-2xl w-full h-full min-h-[334px]">
        <div className="bg-text-primary w-full p-2 rounded-2xl flex flex-col justify-end gap-1 h-1/2">
          <div className="text-heading-1 text-white">$0</div>
          <div className="text-body-4 text-white">General Medicine</div>
        </div>
        <div className="grid grid-cols-2 gap-2 h-1/2">
          <div className="bg-text-primary w-full p-2 rounded-2xl flex flex-col justify-end gap-1 h-full">
            <div className="text-heading-1 text-white">$0</div>
            <div className="text-body-4 text-white">Surgery</div>
          </div>
          <div className="bg-text-primary w-full p-2 rounded-2xl flex flex-col justify-end gap-1 h-full">
            <div className="text-heading-1 text-white">$0</div>
            <div className="text-body-4 text-white">Oncology</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RevenueLeadersStat;
