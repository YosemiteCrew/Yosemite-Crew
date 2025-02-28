import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const ApproachingExpiryChart = ({ data }) => {
  const chartColors = ["#A52A2A", "#C04040", "#E07070", "#F4A9A9"]; // Custom colors for bars

  return (
    <div className="p-4 bg-white rounded-2xl shadow-md">
      <h2 className="text-lg font-semibold text-gray-800 mb-2">Approaching Expiry</h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} barSize={50}>
          <XAxis dataKey="category" tick={{ fill: "#555", fontSize: 14 }} />
          <YAxis tick={{ fill: "#555", fontSize: 14 }} />
          <Tooltip />
          <CartesianGrid strokeDasharray="3 3" />
          <Bar dataKey="totalCount" fill={chartColors[0]} radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ApproachingExpiryChart;
