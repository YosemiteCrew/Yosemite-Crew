import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  Cell,
} from 'recharts';
import './BarGraph.css';

// Define color mapping for departments (or generate random colors)
const departmentColors = {
  Oncology: '#D04122',
  Cardiology: '#FDBD74',
  'Internal Medicine': '#8E88D2',
  Gastroenterology: '#8AC1B1',
  Orthopaedics: '#D04122',
  'Emergency and Critical Care': '#FF6F61',
};

const DepartmentAppointmentsChart = ({ data }) => (
  <div className="WeeklyappontSec">
    <ResponsiveContainer width="100%" height={300}>
      <BarChart layout="vertical" data={data} barCategoryGap="30%">
        <XAxis type="number" axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="name"
          axisLine={false}
          tickLine={false}
          width={150}
        />
        <Tooltip cursor={{ fill: 'transparent' }} />
        <Bar dataKey="appointments" barSize={15} radius={[0, 10, 10, 0]}>
          <LabelList
            dataKey="appointments"
            position="right"
            style={{
              fill: '#302F2E',
              opacity: '70%',
              fontSize: '15px',
              fontWeight: 'bold',
            }}
          />
          {data?.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={departmentColors[entry.name] || '#8884d8'} // Default color
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>
);

export default DepartmentAppointmentsChart;
