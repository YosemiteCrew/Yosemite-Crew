import React from "react";

import "./InviteCard.css"

const InviteCard = ({ invite }: any) => {
  return (
    <div className="invite-card">
      <div className="invite-card-title">{invite.name}</div>
      <div className="invite-card-item">
        <div className="invite-card-item-label">Type :</div>
        <div className="invite-card-item-value">{invite.type}</div>
      </div>
      <div className="invite-card-item">
        <div className="invite-card-item-label">Role :</div>
        <div className="invite-card-item-value">{invite.role}</div>
      </div>
      <div className="invite-card-actions">
        <div className="invite-card-action">Accept</div>
        <div className="invite-card-action">Decline</div>
      </div>
    </div>
  );
};

export default InviteCard;
