'use client';
import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Dropdown } from 'react-bootstrap';
import "./BarGraph.css"


type DataItem = {
  name: string;
  completed: number;
  cancelled: number;
};

const appointmentData: DataItem[] = [
  { name: 'March', completed: 600, cancelled: 100 },
  { name: 'April', completed: 700, cancelled: 120 },
  { name: 'May', completed: 550, cancelled: 200 },
  { name: 'June', completed: 450, cancelled: 60 },
  { name: 'July', completed: 650, cancelled: 90 },
  { name: 'August', completed: 600, cancelled: 100 },
];

const otherData: DataItem[] = [
  { name: 'March', completed: 700, cancelled: 50 },
  { name: 'April', completed: 500, cancelled: 60 },
  { name: 'May', completed: 300, cancelled: 40 },
  { name: 'June', completed: 350, cancelled: 100 },
  { name: 'July', completed: 600, cancelled: 90 },
  { name: 'August', completed: 500, cancelled: 110 },
];

const AppointmentGraph = () => {
  const [selected, setSelected] = useState('Appointments');
  const [chartData, setChartData] = useState<DataItem[]>(appointmentData);

  const handleSelect = (key: string | null) => {
    if (!key) return;
    setSelected(key);
    if (key === 'Appointments') {
      setChartData(appointmentData);
    } else {
      setChartData(otherData);
    }
  };

  return (
    <div className="AppointmentChartWrapper">

      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="legend">
          <span className="dot completed"></span> Completed
          <span className="dot cancelled ms-3"></span> Cancelled
        </div>
        <Dropdown onSelect={handleSelect}>
          <Dropdown.Toggle variant="light" className="dropdown-toggle">
            {selected}
          </Dropdown.Toggle>
          <Dropdown.Menu>
            <Dropdown.Item eventKey="Appointments">Appointments</Dropdown.Item>
            <Dropdown.Item eventKey="Revenue">Revenue</Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} barCategoryGap="20%">
          <CartesianGrid vertical={false} stroke="#f5f5f5" strokeDasharray="3 3" />
          <ReferenceLine x={0} stroke="#dcdcdc" strokeWidth={1} />
          <XAxis dataKey="name"  axisLine={false} tickLine={true} />
          <YAxis type="number"axisLine={false} tickLine={true} />
          <Tooltip />
          <Bar dataKey="completed" stackId="a" fill="#302F2E" radius={[0, 0, 0, 0]} />
          <Bar dataKey="cancelled" stackId="a" fill="#BFBFBE" radius={[10, 10, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default AppointmentGraph;
