import React from "react";

type AppointmentDetailFieldProps = {
  label: string;
  value?: string | null;
};

const AppointmentDetailField = ({ label, value }: AppointmentDetailFieldProps) => (
  <div className="flex gap-1">
    <div className="text-caption-1 text-text-extra">{label}:</div>
    <div className="text-caption-1 text-text-primary">{value || "-"}</div>
  </div>
);

export default AppointmentDetailField;
