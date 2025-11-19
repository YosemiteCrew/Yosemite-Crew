"use client";
import React, { useState } from "react";
import { FaCheckCircle } from "react-icons/fa";
import { IoIosCloseCircle } from "react-icons/io";
import Link from "next/link";

import GenericTable from "@/app/components/GenericTable/GenericTable";
import InviteCard from "../Cards/InviteCard/InviteCard";

import "./DataTable.css";

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
};

const demoData: InviteProps[] = [
  {
    name: "Paws & Tails Health Club",
    type: "Hospital",
    role: "Vet",
  },
  {
    name: "Paws & Tails Health Club",
    type: "Hospital",
    role: "Nurse",
  },
];

const OrgInvites = ({invites}: any) => {
  const [data] = useState<InviteProps[]>(demoData);

  const columns: Column<InviteProps>[] = [
    {
      label: "Name",
      key: "name",
      width: "30%",
      render: (item: InviteProps) => (
        <div className="InviteDetails">{item.name}</div>
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
      label: "Actions",
      key: "actions",
      width: "20%",
      render: (item: InviteProps) => (
        <div className="action-btn-col">
          <Link href={"/team-onboarding"} className="action-btn" style={{ background: "#E6F4EF" }}>
            <FaCheckCircle size={22} color="#54B492" />
          </Link>
          <div className="action-btn" style={{ background: "#FDEBEA" }}>
            <IoIosCloseCircle size={24} color="#EA3729" />
          </div>
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
        {demoData.map((invite, index) => (
          <InviteCard key={invite.name + index} invite={invite} />
        ))}
      </div>
    </div>
  );
};

export default OrgInvites;
