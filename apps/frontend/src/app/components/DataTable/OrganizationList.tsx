"use client";
import React from "react";
import { useRouter } from "next/navigation";

import OrgCard from "../Cards/OrgCard/OrgCard";
import GenericTable from "@/app/components/GenericTable/GenericTable";
import { useOrgStore } from "@/app/stores/orgStore";
import { OrgWithMembership } from "@/app/types/org";

import "./DataTable.css";

type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
};

type OrganizationListProps = {
  orgs: OrgWithMembership[];
};

export const getStatusStyle = (status: string) => {
  switch (status?.toLowerCase()) {
    case "active":
      return { color: "#54B492", backgroundColor: "#E6F4EF" };
    case "pending":
      return { color: "#F68523", backgroundColor: "#FEF3E9" };
    default:
      return { color: "#fff", backgroundColor: "#247AED" };
  }
};

const OrganizationList = ({ orgs }: OrganizationListProps) => {
  const router = useRouter();
  const setPrimaryOrg = useOrgStore((s) => s.setPrimaryOrg);

  const handleOrgClick = (org: OrgWithMembership) => {
    const id = org.org._id?.toString() || org.org.name;
    setPrimaryOrg(id);
    if (org.org.isVerified) {
      router.push("/dashboard");
    } else {
      router.push("/create-org?orgId=" + id);
    }
  };

  const columns: Column<OrgWithMembership>[] = [
    {
      label: "Name",
      key: "name",
      width: "30%",
      render: (item: OrgWithMembership) => (
        <button
          onClick={() => handleOrgClick(item)}
          className="OrgListDetails text-left"
        >
          {item.org.name}
        </button>
      ),
    },
    {
      label: "Type",
      key: "type",
      width: "25%",
      render: (item: OrgWithMembership) => (
        <div className="InviteTime">{item.org.type}</div>
      ),
    },
    {
      label: "Role",
      key: "role",
      width: "25%",
      render: (item: OrgWithMembership) => (
        <div className="InviteExpires">{item.membership?.roleDisplay}</div>
      ),
    },
    {
      label: "Status",
      key: "status",
      width: "20%",
      render: (item: OrgWithMembership) => (
        <div
          className="OrgStatus"
          style={getStatusStyle(item.org.isVerified ? "Active" : "Pending")}
        >
          {item.org.isVerified ? "Active" : "Pending"}
        </div>
      ),
    },
  ];

  return (
    <div className="table-wrapper">
      <div className="table-list">
        <GenericTable
          data={orgs}
          columns={columns}
          bordered={false}
          pageSize={5}
          pagination
        />
      </div>
      <div className="card-list">
        {orgs.map((org, index) => (
          <OrgCard
            key={org.org.name + index}
            org={org}
            handleOrgClick={handleOrgClick}
          />
        ))}
      </div>
    </div>
  );
};

export default OrganizationList;
