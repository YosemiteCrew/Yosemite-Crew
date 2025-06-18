// components/StatusBadge.tsx
"use client";
import React from "react";


const statusColorMap: Record<string, string> = {
  'Available': 'success',
  'Off-Duty': 'secondary',
  'Consulting': 'danger',
};

const StatusBadge = ({ status }: { status: string }) => {
  const color = statusColorMap[status] || 'light';
  return <span className={`status-badge status-${color}`}>{status}</span>;
};

export default StatusBadge;
