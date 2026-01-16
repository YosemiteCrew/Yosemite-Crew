"use client";
import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  LineChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { LayoutType } from "recharts/types/util/types";

type ChartProps = {
  data: any[];
  type?: "bar" | "line";
  keys: { name: string; color: string }[];
  yTickFormatter?: (value: number) => string;
  layout?: LayoutType;
  hideKeys?: boolean;
};

const DynamicChartCard: React.FC<ChartProps> = ({
  data,
  type = "bar",
  keys,
  yTickFormatter,
  layout,
  hideKeys = false,
}) => {
  const renderChart = () => {
    if (type === "line") {
      return (
        <LineChart data={data}>
          <XAxis dataKey="month" />
          <YAxis tickFormatter={yTickFormatter} />
          <Tooltip />
          {keys.map((key) => (
            <Line
              key={key.name}
              type="monotone"
              dataKey={key.name}
              stroke={key.color}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      );
    }

    return (
      <BarChart
        data={data}
        layout={layout}
        style={{
          height: "100%",
          maxHeight: "100%",
          width: "100%",
          maxWidth: "100%",
        }}
        margin={{
          top: 0,
          right: 0,
          left: -30,
          bottom: 0,
        }}
      >
        <CartesianGrid strokeDasharray="4 4" vertical={false} />
        <XAxis dataKey="month" />
        <YAxis tickFormatter={yTickFormatter} />
        {keys.map((key) => (
          <Bar key={key.name} dataKey={key.name} fill={key.color} stackId="a" />
        ))}
      </BarChart>
    );
  };

  return (
    <div className="bg-white border border-card-border p-3 flex flex-col gap-2 rounded-2xl">
      {!hideKeys && (
        <div className="flex items-center justify-center w-full gap-6">
          {keys.map((key) => (
            <span key={key.name} className="flex items-center gap-1.5">
              <span
                style={{
                  width: "16px",
                  height: "16px",
                  backgroundColor: key.color,
                  borderRadius: "50%",
                  display: "inline-block",
                }}
              />
              <span className="text-capton-1 text-text-primary">{key.name}</span>
            </span>
          ))}
        </div>
      )}
      <ResponsiveContainer
        width="100%"
        height={300}
      >
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
};

export default DynamicChartCard;
