"use client";
import React, { useEffect, useState } from "react";

import ProtectedRoute from "@/app/components/ProtectedRoute";
import { Primary } from "@/app/components/Buttons";
import OrgInvites from "../../components/DataTable/OrgInvites";
import OrganizationList from "../../components/DataTable/OrganizationList";
import { useOrgStore } from "@/app/stores/orgStore";
import { useOrgWithMemberships } from "@/app/hooks/useOrgSelectors";

import { getData } from "@/app/services/axios";
import { Invite } from "@/app/types/team";

import "./Organizations.css";

const Organizations = () => {
  const orgs = useOrgWithMemberships();
  const orgStatus = useOrgStore((s) => s.status);
  const [invites, setInvites] = useState<Invite[]>([]);

  const isLoading = orgStatus === "loading";

  const loadInvites = async () => {
    try {
      const res = await getData<Invite[]>(
        "/fhir/v1/organisation-invites/me/pending"
      );
      const invites: Invite[] = [];
      for (const invite of res.data as any) {
        invites.push({ ...invite.invite, ...invite });
      }
      setInvites(invites);
    } catch (err: any) {
      console.error("Failed to load invites:", err);
      setInvites([]);
    }
  };

  useEffect(() => {
    loadInvites();
  }, []);

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
