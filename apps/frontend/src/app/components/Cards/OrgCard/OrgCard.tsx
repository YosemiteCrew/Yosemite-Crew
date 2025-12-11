import React from "react";
import { getStatusStyle } from "../../DataTable/OrganizationList";
import { OrgWithMembership } from "@/app/types/org";

import "./OrgCard.css";

type OrgCardProps = {
  org: OrgWithMembership;
  handleOrgClick: (org: OrgWithMembership) => void;
};

const OrgCard = ({ org, handleOrgClick }: OrgCardProps) => {
  return (
    <div className="org-card">
      <button onClick={() => handleOrgClick(org)} className="org-card-title">
        {org.org.name}
      </button>
      <div className="org-card-item">
        <div className="org-card-item-label">Type :</div>
        <div className="org-card-item-value">{org.org.type}</div>
      </div>
      <div className="org-card-item">
        <div className="org-card-item-label">Role :</div>
        <div className="org-card-item-value">{org.membership?.roleDisplay}</div>
      </div>
      <div
        className="org-card-status"
        style={getStatusStyle(org.org.isVerified ? "Active" : "Pending")}
      >
        {org.org.isVerified ? "Active" : "Pending"}
      </div>
    </div>
  );
};

export default OrgCard;
