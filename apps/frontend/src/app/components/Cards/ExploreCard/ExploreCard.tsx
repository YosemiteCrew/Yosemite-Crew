import React from "react";
import CardHeader from "../CardHeader/CardHeader";

import "./ExploreCard.css";

const DummyStats = [
  {
    name: "Revenue",
    value: "$0",
  },
  {
    name: "Appointments",
    value: "0",
  },
  {
    name: "Tasks",
    value: "0",
  },
  {
    name: "Staff on duty",
    value: "0",
  },
];

const Explorecard = () => {
  return (
    <div className="explore-container">
      <CardHeader
        title={"Explore"}
        options={["Last week", "Last month", "Last 6 months", "Last 1 year"]}
      />
      <div className="explore-cards">
        {DummyStats.map((stat) => (
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
