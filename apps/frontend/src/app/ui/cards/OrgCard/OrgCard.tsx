import React from "react";
import { getStatusStyle } from "@/app/ui/tables/OrganizationList";
import { OrgWithMembership } from "@/app/features/organization/types/org";

import "./OrgCard.css";
import { toTitleCase } from "@/app/lib/validators";

type OrgCardProps = {
  org: OrgWithMembership;
  handleOrgClick: (org: OrgWithMembership) => void;
};

const OrgCard = ({ org, handleOrgClick }: OrgCardProps) => {
  return (
    <div className="org-card">
      <button
        onClick={() => handleOrgClick(org)}
        className="text-body-3-emphasis text-text-brand"
      >
        {org.org.name}
      </button>
      <div className="org-card-item">
        <div className="text-caption-1 text-text-extra">Type :</div>
        <div className="text-caption-1 text-text-primary">
          {toTitleCase(org.org.type)}
        </div>
      </div>
      <div className="org-card-item">
        <div className="text-caption-1 text-text-extra">Role :</div>
        <div className="text-caption-1 text-text-primary">
          {toTitleCase(org.membership?.roleDisplay)}
        </div>
      </div>
      <div
        className="w-full rounded-2xl h-12 flex items-center justify-center text-body-4"
        style={getStatusStyle(org.org.isVerified ? "Active" : "Pending")}
      >
        {org.org.isVerified ? "Active" : "Pending"}
      </div>
    </div>
  );
};

export default OrgCard;
