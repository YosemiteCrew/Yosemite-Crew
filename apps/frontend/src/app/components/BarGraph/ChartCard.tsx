import React from "react";
import { Card, Button } from "react-bootstrap";
import { Line } from "react-chartjs-2";

import type { ChartOptions } from "chart.js";

import "chart.js/auto";

const data = {
  labels: ["March", "April", "May", "June", "July", "August"],
  datasets: [
    {
      label: "Revenue",
      data: [4000, 8000, 16000, 7000, 9000, 15000],
      fill: true,
      backgroundColor: "#BFBFBEB2",
      borderColor: "#302F2E",
      tension: 0.4,
      pointRadius: 0,
    },
  ],
};

const options: ChartOptions<"line"> = {
  plugins: { legend: { display: false } },
  scales: {
    y: {
      beginAtZero: true,
      min: 0,
      max: 20000,
      ticks: {
        stepSize: 4000,
        callback: (tickValue: string | number) => {
          const value =
            typeof tickValue === "number" ? tickValue : Number.parseFloat(tickValue);
          return `$${value === 0 ? "0" : value / 1000 + "K"}`;
        },
        color: "#302F2E",
        font: { size: 14 },
        padding: 8,
      },
      grid: { color: "#BFBFBEB2" },
    },
    x: {
      ticks: { color: "#302F2E", font: { size: 14 } },
      grid: { display: false },
    },
  },
  layout: {
    padding: { left: 0, right: 0, top: 10, bottom: 0 },
  },
  elements: {
    line: { borderWidth: 3 },
  },
};

const ChartCard = () => (
  <Card className="chart-card">
    <Card.Body>
      <div className="bargraph-chart-container">
        <Line data={data} options={options} height={170} />
      </div>
      <Button className="chat-btn" variant="light">
        <img
          src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><text y='20' font-size='20'>💬</text></svg>"
          alt="chat"
          style={{ width: "1.2em", height: "1.2em", verticalAlign: "middle" }}
        />{" "}
        Chat
      </Button>
    </Card.Body>
  </Card>
);

export default ChartCard;
