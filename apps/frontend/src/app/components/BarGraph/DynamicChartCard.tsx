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
} from "recharts";
import { Card } from "react-bootstrap";

type ChartProps = {
  data: any[];
  type?: "bar" | "line";
  keys: { name: string; color: string }[];
  yTickFormatter?: (value: number) => string;
};

const DynamicChartCard: React.FC<ChartProps> = ({
  data,
  type = "bar",
  keys,
  yTickFormatter,
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
      <BarChart data={data}>
        <XAxis dataKey="month" />
        <YAxis tickFormatter={yTickFormatter} />
        <Tooltip />
        {keys.map((key) => (
          <Bar key={key.name} dataKey={key.name} fill={key.color} stackId="a" />
        ))}
      </BarChart>
    );
  };

  return (
    <Card className="p-3 shadow-sm chart-card">
      <div className="d-flex gap-3 ms-2 mb-2">
        {keys.map((key) => (
          <span key={key.name} className="d-flex align-items-center gap-1">
            <span
              style={{
                width: "10px",
                height: "10px",
                backgroundColor: key.color,
                borderRadius: "50%",
                display: "inline-block",
              }}
            />
            <span>{key.name}</span>
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={250}>
        {renderChart()}
      </ResponsiveContainer>
    </Card>
  );
};

export default DynamicChartCard;
