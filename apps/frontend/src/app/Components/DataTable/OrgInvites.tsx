"use client";
import React, { useState } from "react";
import { FaCheckCircle } from "react-icons/fa";
import { IoIosCloseCircle } from "react-icons/io";

import GenericTable from "@/app/components/GenericTable/GenericTable";

import "./DataTable.css";

type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
};

type InviteProps = {
  details: string;
  time: string;
  expires: string;
};

const demoData: InviteProps[] = [
  {
    details: "Invite Details 1",
    time: "10:00 AM",
    expires: "2023-12-31",
  },
];

const OrgInvites = (invites: any) => {
  const [data] = useState<InviteProps[]>(demoData);

  const columns: Column<InviteProps>[] = [
    {
      label: "Details",
      key: "details",
      width: "45%",
      render: (item: InviteProps) => (
        <div className="InviteDetails">{item.details}</div>
      ),
    },
    {
      label: "Time",
      key: "time",
      width: "15%",
      render: (item: InviteProps) => (
        <div className="InviteTime">{item.time}</div>
      ),
    },
    {
      label: "Expires",
      key: "expires",
      width: "15%",
      render: (item: InviteProps) => (
        <div className="InviteExpires">{item.expires}</div>
      ),
    },
    {
      label: "Actions",
      key: "actions",
      width: "25%",
      render: (item: InviteProps) => (
        <div className="action-btn-col">
          <div className="action-btn">
            <div className="action-btn-text">Accept</div>
            <FaCheckCircle size={14} />
          </div>
          <div className="action-btn">
            <div className="action-btn-text">Decline</div>
            <IoIosCloseCircle size={14} />
          </div>
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
};

export default OrgInvites;
