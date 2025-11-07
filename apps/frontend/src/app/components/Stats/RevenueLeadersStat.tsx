import React from "react";
import CardHeader from "../Cards/CardHeader/CardHeader";

import "./Stats.css";

const RevenueLeadersStat = () => {
  return (
    <div className="stat-container">
      <CardHeader
        title={"Revenue leaders"}
        options={["Last week", "Last month", "Last 6 months", "Last 1 year"]}
      />
      <div className="stat-revenue-leaders">
        <div className="stat-revenue-leader">
          <div className="stat-revenue-leader-value">$0</div>
          <div className="stat-revenue-leader-name">General Medicine</div>
        </div>
        <div className="stat-revenue-leader-two">
          <div className="stat-revenue-leader">
            <div className="stat-revenue-leader-value">$0</div>
            <div className="stat-revenue-leader-name">Surgery</div>
          </div>
          <div className="stat-revenue-leader">
            <div className="stat-revenue-leader-value">$0</div>
            <div className="stat-revenue-leader-name">Oncology</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RevenueLeadersStat;
