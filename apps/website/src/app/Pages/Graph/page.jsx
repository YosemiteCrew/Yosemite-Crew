import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  // Legend,
  ResponsiveContainer,
} from "recharts";

const CustomLegend = () => (
  <div
    style={{
      display: "flex",
      justifyContent: "center",
      gap: "15px",
      marginBottom: "10px",
    }}
  >
    <div style={{ display: "flex", alignItems: "center" }}>
      <span
        style={{
          width: 10,
          height: 10,
          backgroundColor: "#FFCC80",
          borderRadius: "50%",
          display: "inline-block",
          marginRight: 5,
        }}
      ></span>
      <span>Completed</span>
    </div>
    <div style={{ display: "flex", alignItems: "center" }}>
      <span
        style={{
          width: 10,
          height: 10,
          backgroundColor: "#D84315",
          borderRadius: "50%",
          display: "inline-block",
          marginRight: 5,
        }}
      ></span>
      <span>Cancelled</span>
    </div>
  </div>
);

const StackedBarChart = ({ data }) => {
  return (
    <div
      style={{ background: "#FDF8F5", padding: "20px", borderRadius: "12px" }}
    >
      <CustomLegend />
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={data}
          margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
        >
          <XAxis dataKey="month" tick={{ fill: "#444", fontSize: "12px" }} />
          <YAxis tick={{ fill: "#444" }} />
          <Tooltip />
          <Bar
            dataKey="completed"
            stackId="a"
            fill="#FFCC80"
            radius={[5, 5, 0, 0]}
          />
          <Bar
            dataKey="cancelled"
            stackId="a"
            fill="#D84315"
            radius={[5, 5, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default StackedBarChart;
