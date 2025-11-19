 "use client";
import React, { useMemo } from "react";

import "@/app/pages/Organizations/Organizations.css";
import "@/app/pages/Settings/Settings.css";
import { useAuthStore } from "@/app/stores/authStore";

const SettingsPage = () => {
  const { session, user } = useAuthStore();
  const payload = session?.getIdToken().decodePayload();

  const displayName = useMemo(() => {
    const name = `${payload?.given_name || ""} ${payload?.family_name || ""}`.trim();
    if (name) return name;
    if (payload?.email) return payload.email;
    return user?.getUsername() || "User";
  }, [payload?.email, payload?.family_name, payload?.given_name, user]);

  return (
    <div className="OperationsWrapper">
      <div className="TitleContainer">
        <h2>Settings</h2>
      </div>
      <div className="OrgaizationsList">
        <div className="InviteTitle">Profile</div>
        <div className="SettingsCard">
          <p className="SettingsRow"><strong>Name:</strong> {displayName}</p>
          <p className="SettingsRow"><strong>Email:</strong> {payload?.email || "-"}</p>
          <p className="SettingsRow"><strong>Role:</strong> {payload?.["custom:role"] || "Member"}</p>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
