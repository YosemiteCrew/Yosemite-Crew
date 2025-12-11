import React from "react";
import { Invite } from "@/app/types/team";

import "./InviteCard.css";

type InviteCardProps = {
  invite: Invite;
  handleAccept: (invite: Invite) => Promise<void>;
  handleReject: (invite: Invite) => void;
};

const InviteCard = ({
  invite,
  handleAccept,
  handleReject,
}: InviteCardProps) => {
  return (
    <div className="invite-card">
      <div className="invite-card-title">{invite.organisationName}</div>
      <div className="invite-card-item">
        <div className="invite-card-item-label">Type :</div>
        <div className="invite-card-item-value">{invite.organisationType}</div>
      </div>
      <div className="invite-card-item">
        <div className="invite-card-item-label">Role :</div>
        <div className="invite-card-item-value">{invite.role}</div>
      </div>
      <div className="invite-card-item">
        <div className="invite-card-item-label">Employee type :</div>
        <div className="invite-card-item-value">
          {invite.employmentType.split("_").join(" ")}
        </div>
      </div>
      <div className="invite-card-actions">
        <button
          onClick={() => handleAccept(invite)}
          className="invite-card-action"
        >
          Accept
        </button>
        <button
          onClick={() => handleReject(invite)}
          className="invite-card-action"
        >
          Decline
        </button>
      </div>
    </div>
  );
};

export default InviteCard;
