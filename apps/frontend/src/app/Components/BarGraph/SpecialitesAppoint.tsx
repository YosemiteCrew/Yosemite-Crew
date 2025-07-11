'use client';
import React from 'react';
import { Card } from 'react-bootstrap';
import "./BarGraph.css"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface SpecialitesAppointProps {
  appointmentsData: { day: string; appointments: number }[];
}

function SpecialitesAppoint({ appointmentsData }: SpecialitesAppointProps) {
  // Calculate total dynamically
  const totalAppointments = appointmentsData.reduce((sum, d) => sum + d.appointments, 0);

  return (
    <Card className="SpeclAppotChartWrapper">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <strong>Appointments</strong> <span className="text-muted">(last 7 days)</span>
        </div>
        <div>
          <h4>{totalAppointments}</h4>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={appointmentsData}>
          <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 13 ,fontWeight: 500, fill: '#302F2E'}} />
          <YAxis axisLine={false} tickLine={true} tick={{  fill: '#302F2E' }}/>
          <Tooltip />
          <Bar dataKey="appointments" fill="#000" barSize={20} radius={[5, 5, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

export default SpecialitesAppoint;
