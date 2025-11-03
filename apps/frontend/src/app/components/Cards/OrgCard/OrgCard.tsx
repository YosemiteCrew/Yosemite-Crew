import React from "react";

import "./OrgCard.css";

const OrgCard = ({ org }: any) => {
  return (
    <div className="org-card">
      <div className="org-card-title">{org.name}</div>
      <div className="org-card-item">
        <div className="org-card-item-label">Type :</div>
        <div className="org-card-item-value">{org.type}</div>
      </div>
      <div className="org-card-item">
        <div className="org-card-item-label">Role :</div>
        <div className="org-card-item-value">{org.role}</div>
      </div>
      <div
        className="org-card-status"
        style={{ color: org.color, background: org.bgcolor }}
      >
        {org.status}
      </div>
    </div>
  );
};

export default OrgCard;
