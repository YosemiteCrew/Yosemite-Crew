"use client";
import React from "react";
import { FaCheckCircle } from "react-icons/fa";
import { IoIosCloseCircle } from "react-icons/io";

import GenericTable from "@/app/components/GenericTable/GenericTable";
import InviteCard from "../Cards/InviteCard/InviteCard";
import { Invite } from "@/app/types/team";

import { useRouter } from "next/navigation";
import { acceptInvite } from "@/app/services/teamService";

import "./DataTable.css";

type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
};

type OrgInvitesProps = {
  invites: Invite[];
};

const OrgInvites = ({ invites }: OrgInvitesProps) => {
  const router = useRouter();

  const handleAccept = async (invite: Invite) => {
    try {
      await acceptInvite(invite);
      router.push("/team-onboarding?orgId=" + invite.organisationId);
    } catch (error) {
      console.log(error);
    }
  };

  const handleReject = (invite: Invite) => {};

  const columns: Column<Invite>[] = [
    {
      label: "Name",
      key: "name",
      width: "25%",
      render: (item: Invite) => (
        <div className="InviteDetails">{item.organisationName}</div>
      ),
    },
    {
      label: "Type",
      key: "type",
      width: "20%",
      render: (item: Invite) => (
        <div className="InviteTime">{item.organisationType}</div>
      ),
    },
    {
      label: "Role",
      key: "role",
      width: "20%",
      render: (item: Invite) => (
        <div className="InviteExpires">{item.role}</div>
      ),
    },
    {
      label: "Employee type",
      key: "employee-type",
      width: "20%",
      render: (item: Invite) => (
        <div className="InviteExpires">
          {item.employmentType.split("_").join(" ")}
        </div>
      ),
    },
    {
      label: "Actions",
      key: "actions",
      width: "15%",
      render: (item: Invite) => (
        <div className="action-btn-col">
          <button
            onClick={() => handleAccept(item)}
            className="action-btn"
            style={{ background: "#E6F4EF" }}
          >
            <FaCheckCircle size={22} color="#54B492" />
          </button>
          <button
            onClick={() => handleReject(item)}
            className="action-btn"
            style={{ background: "#FDEBEA" }}
          >
            <IoIosCloseCircle size={24} color="#EA3729" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="table-wrapper">
      <div className="table-list">
        <GenericTable
          data={invites}
          columns={columns}
          bordered={false}
          pageSize={5}
          pagination
        />
      </div>
      <div className="card-list">
        {invites.map((invite, index) => (
          <InviteCard
            key={invite._id + index}
            invite={invite}
            handleAccept={handleAccept}
            handleReject={handleReject}
          />
        ))}
      </div>
    </div>
  );
};

export default OrgInvites;
