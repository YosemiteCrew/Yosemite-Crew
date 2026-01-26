 "use client";
import React, { useMemo } from "react";

import "@/app/pages/Organizations/Organizations.css";
import "@/app/pages/Settings/Settings.css";
import DevRouteGuard from "@/app/components/DevRouteGuard/DevRouteGuard";
import { useAuthStore } from "@/app/stores/authStore";

const DevSettingsPage = () => {
  const { session, user } = useAuthStore();
  const payload = session?.getIdToken().decodePayload();

  const displayName = useMemo(() => {
    const name = `${payload?.given_name || ""} ${payload?.family_name || ""}`.trim();
    if (name) return name;
    if (payload?.email) return payload.email;
    return user?.getUsername() || "Developer";
  }, [payload?.email, payload?.family_name, payload?.given_name, user]);

  return (
    <DevRouteGuard>
      <div className="OperationsWrapper">
        <div className="TitleContainer">
          <h2>Developer Settings</h2>
        </div>
        <div className="OrgaizationsList">
          <div className="InviteTitle">Profile</div>
          <div className="SettingsCard">
            <p className="SettingsRow"><strong>Name:</strong> {displayName}</p>
            <p className="SettingsRow"><strong>Email:</strong> {payload?.email || "-"}</p>
            <p className="SettingsRow"><strong>Role:</strong> {(payload?.["custom:role"] as string) || "Developer"}</p>
          </div>
        </div>
      </div>
    </DevRouteGuard>
  );
};

export default DevSettingsPage;
