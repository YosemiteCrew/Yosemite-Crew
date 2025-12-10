"use client";
import React from "react";

import ProtectedRoute from "@/app/components/ProtectedRoute";
import { Primary } from "@/app/components/Buttons";
import OrgInvites from "../../components/DataTable/OrgInvites";
import OrganizationList from "../../components/DataTable/OrganizationList";
import { useLoadOrgAndInvites } from "@/app/hooks/useLoadOrgAndInvites";
import { useInviteStore } from "@/app/stores/inviteStore";
import { useOrgStore } from "@/app/stores/orgStore";
import { useOrgWithMemberships } from "@/app/hooks/useOrgSelectors";

import "./Organizations.css";

const Organizations = () => {
  useLoadOrgAndInvites();

  const orgs = useOrgWithMemberships()
  const orgStatus = useOrgStore((s) => s.status);

  const invites = useInviteStore((s) => s.invites);
  const inviteStatus = useInviteStore((s) => s.status);

  const isLoading = orgStatus === "loading" || inviteStatus === "loading";

  if (isLoading) return null;

  return (
    <div className="OperationsWrapper">
      <div className="TitleContainer">
        <h2>Overview</h2>
        <Primary href="/create-org" text="Create organisation" />
      </div>

      <div className="OrgaizationsList">
        <div className="InviteTitle">Existing organisations</div>
        <OrganizationList orgs={orgs} />
      </div>

      <div className="InvitesWrapper">
        <div className="InviteTitle">Invites</div>
        <OrgInvites invites={invites} />
      </div>
    </div>
  );
};

const ProtectedOrganizations = () => {
  return (
    <ProtectedRoute>
      <Organizations />
    </ProtectedRoute>
  );
};

export default ProtectedOrganizations;
