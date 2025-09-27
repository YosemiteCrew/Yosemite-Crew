"use client";
import React, { useState } from "react";
import "./DataTable.css";
import GenericTable from "../GenericTable/GenericTable";
import { AiFillMinusCircle } from "react-icons/ai";

type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
};

type InviteProps = {
  details: string;
  plan: string;
  role: string;
  status?: string;
};

const demoData: InviteProps[] = [
  {
    details: "Organizations Details 1",
    plan: "Paid",
    role: "Owner",
    status: "Verification Pending",
  },
];

function OrganizationList() {
  const [data] = useState<InviteProps[]>(demoData);

  const columns: Column<InviteProps>[] = [
    {
      label: "Details",
      key: "details",
      width: "45%",
      render: (item: InviteProps) => (
        <div className="OrgListDetailsCol">
          <div className="OrgListDetails">{item.details}</div>
          <div className="OrgStatus">{item.status}</div>
        </div>
      ),
    },
    {
      label: "Plan",
      key: "plan",
      width: "15%",
      render: (item: InviteProps) => (
        <div className="InviteTime">{item.plan}</div>
      ),
    },
    {
      label: "Role",
      key: "role",
      width: "15%",
      render: (item: InviteProps) => (
        <div className="InviteExpires">{item.role}</div>
      ),
    },
    {
      label: "Actions",
      key: "actions",
      width: "25%",
      render: (item: InviteProps) => (
          <div className="action-btn">
            <div className="action-btn-text">Leave</div>
            <AiFillMinusCircle size={14} />
          </div>
      ),
    },
  ];

  return (
    <div className="table-wrapper">
      <GenericTable
        data={data}
        columns={columns}
        bordered={false}
        pageSize={3}
        pagination
      />
    </div>
  );
}

export default OrganizationList;
