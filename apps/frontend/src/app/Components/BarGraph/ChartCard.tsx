import React from "react";
import { Card, Button } from "react-bootstrap";
import { Line } from "react-chartjs-2";
import "chart.js/auto";
import type { ChartOptions } from "chart.js";

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
          const value = typeof tickValue === "number" ? tickValue : parseFloat(tickValue);
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
    padding: { left: 0, right: 0, top: 10, bottom: 0 }
  },
  elements: {
    line: { borderWidth: 3 }
  }
};

const ChartCard = () => (
  <Card className="chart-card">
    <Card.Body>
      <div className="bargraph-chart-container">
        <Line data={data} options={options} height={170} />
      </div>
      <Button className="chat-btn" variant="light">
        <span role="img" aria-label="chat">💬</span> Chat
      </Button>
    </Card.Body>
  </Card>
);

export default ChartCard;