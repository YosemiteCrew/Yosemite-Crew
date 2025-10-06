"use client";
import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  ReferenceLine,
} from "recharts";

import "./BarGraph.css";

interface DepartmentData {
  name: string;
  value: number;
}

interface Props {
  data: DepartmentData[];
}

const DepartmentBarChart: React.FC<Props> = ({ data }) => {
  return (
    <div className="DepartChartWrapper">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 20, right: 30, left: 60, bottom: 10 }}
        >
          <CartesianGrid
            vertical={false}
            stroke="#f5f5f5"
            strokeDasharray="3 3"
          />
          <ReferenceLine x={0} stroke="#dcdcdc" strokeWidth={1} />

          <XAxis
            type="number"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 13, fontWeight: 500, fill: "#302F2E" }}
          />
          <YAxis
            dataKey="name"
            type="category"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 13, fontWeight: 700, fill: "#302F2E" }}
          />
          <Tooltip />
          <Bar
            dataKey="value"
            fill="#302F2E"
            barSize={12}
            radius={[0, 10, 10, 0]}
          >
            <LabelList
              dataKey="value"
              position="right"
              style={{ fill: "#302F2E", fontWeight: 500 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default DepartmentBarChart;
