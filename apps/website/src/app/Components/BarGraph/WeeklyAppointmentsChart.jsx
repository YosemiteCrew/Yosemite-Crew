
import React from 'react';
import './BarGraph.css';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';

// const data = [
//   { name: "M", appointments: 60 },
//   { name: "T", appointments: 85 },
//   { name: "W", appointments: 100 },
//   { name: "T", appointments: 40 },
//   { name: "F", appointments: 75 },
//   { name: "S", appointments: 65 },
//   { name: "M", appointments: 55 },
// ];

const WeeklyAppointmentsChart = ({ data }) => (
  <div className="WeeklyappontSec">
    <div className="WeeklyHead">
      <h5>
        Appointments <span>( last 7 days )</span>
      </h5>
      <h4>247</h4>
    </div>
    <ResponsiveContainer width="100%" height={225}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="name"
          axisLine={false}
          tickLine={false}
          tickFormatter={(name) => name.charAt(0)}
        />
        <YAxis axisLine={false} tickLine={true} />
        <Tooltip cursor={{ fill: 'transparent' }} />
        <Bar
          dataKey="appointments"
          fill="#ff9f43"
          barSize={30}
          radius={[5, 5, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  </div>
);

export default WeeklyAppointmentsChart;
