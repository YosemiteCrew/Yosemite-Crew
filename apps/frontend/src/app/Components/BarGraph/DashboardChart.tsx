// components/DashboardChart.tsx
"use client";
import React from "react";
import { Card } from "react-bootstrap";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area
} from "recharts";

type ChartProps = {
  title: string;
  data: any[];
  type: "bar" | "line";
  showEmpty?: boolean;
}

const DashboardChart: React.FC<ChartProps> = ({ data, type, showEmpty }) => {
  const emptyGraph = (
    <div className="d-flex align-items-center justify-content-center" style={{ height: 200, color: "#ccc" }}>
      No data available
    </div>
  );

  return (
    <Card className="p-3 shadow-sm mb-4 chart-card">
      

      {showEmpty ? emptyGraph : (
        <ResponsiveContainer width="100%" height={250}>
          {type === "bar" ? (
            <BarChart data={data}>
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="completed" stackId="a" fill="#111" />
              <Bar dataKey="cancelled" stackId="a" fill="#ccc" />
            </BarChart>
          ) : (
            <AreaChart data={data}>
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="revenue" stroke="#111" fill="#e6e6e6" />
            </AreaChart>
          )}
        </ResponsiveContainer>
      )}
    </Card>
  );
};

export default DashboardChart;
