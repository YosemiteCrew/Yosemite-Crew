"use client";
import React, { useState } from "react";

import GenericTable from "@/app/components/GenericTable/GenericTable";

import "./DataTable.css";
import OrgCard from "../Cards/OrgCard/OrgCard";

type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
};

type InviteProps = {
  name: string;
  type: string;
  role: string;
  status: string;
  color: string;
  bgcolor: string;
};

const demoData: InviteProps[] = [
  {
    name: "Paws & Tails Health Club",
    type: "Hospital",
    role: "Owner",
    status: "Pending",
    color: "#f68523",
    bgcolor: "#fef3e9",
  },
  {
    name: "Paws & Tails Health Club",
    type: "Clinic",
    role: "Owner",
    status: "Active",
    color: "#54B492",
    bgcolor: "#E6F4EF",
  },
  {
    name: "Paws & Tails Health Club",
    type: "Clinic",
    role: "Owner",
    status: "Active",
    color: "#54B492",
    bgcolor: "#E6F4EF",
  },
];

const OrganizationList = ({org}: any) => {
  const [data] = useState<InviteProps[]>(demoData);

  const columns: Column<InviteProps>[] = [
    {
      label: "Name",
      key: "name",
      width: "30%",
      render: (item: InviteProps) => (
        <div className="OrgListDetails">{item.name}</div>
      ),
    },
    {
      label: "Type",
      key: "type",
      width: "25%",
      render: (item: InviteProps) => (
        <div className="InviteTime">{item.type}</div>
      ),
    },
    {
      label: "Role",
      key: "role",
      width: "25%",
      render: (item: InviteProps) => (
        <div className="InviteExpires">{item.role}</div>
      ),
    },
    {
      label: "Status",
      key: "status",
      width: "20%",
      render: (item: InviteProps) => (
        <div
          className="OrgStatus"
          style={{ color: item.color, background: item.bgcolor }}
        >
          {item.status}
        </div>
      ),
    },
  ];

  return (
    <div className="table-wrapper">
      <div className="table-list">
        <GenericTable
          data={data}
          columns={columns}
          bordered={false}
          pageSize={3}
          pagination
        />
      </div>
      <div className="card-list">
        {demoData.map((org, index) => (
          <OrgCard key={org.name + index} org={org} />
        ))}
      </div>
    </div>
  );
};

export default OrganizationList;
