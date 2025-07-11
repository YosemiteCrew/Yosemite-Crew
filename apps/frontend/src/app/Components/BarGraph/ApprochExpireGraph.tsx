"use client";
import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ChartData {
  name: string;
  value: number;
}

interface ApprochExpireGraphProps {
  chartData: ChartData[];
}

function ApprochExpireGraph({ chartData }: ApprochExpireGraphProps) {
  return (
    <ResponsiveContainer width="100%" height={350} className="DepartChartWrapper">
      <BarChart
        data={chartData}
        margin={{
          top: 20,
          right: 30,
          left: 20,
          bottom: 5,
        }}
      >
        <XAxis dataKey="name" axisLine={false} tickLine={false} />
        <YAxis axisLine={false} tickLine={false} />
        <Tooltip />
        <Bar dataKey="value" fill="#333" barSize={30} radius={[10, 10, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default ApprochExpireGraph;