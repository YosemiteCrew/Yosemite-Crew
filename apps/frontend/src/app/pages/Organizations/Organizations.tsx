"use client";
import React, { useEffect, useState } from "react";

import ProtectedRoute from "@/app/components/ProtectedRoute";
import { getData } from "@/app/services/axios";
import { Primary } from "@/app/components/Buttons";
import OrgInvites from "../../components/DataTable/OrgInvites";
import OrganizationList from "../../components/DataTable/OrganizationList";

import "./Organizations.css";

const Organizations = () => {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrganizations = async () => {
    try {
      const [orgRes, inviteRes] = await Promise.allSettled([
        getData<any[]>("/api/v1/organization"),
        getData<any[]>("/api/v1/invites"),
      ]);

      if (orgRes.status === "fulfilled" && orgRes.value.status === 200) {
        setOrgs(orgRes.value.data);
      }
      if (inviteRes.status === "fulfilled" && inviteRes.value.status === 200) {
        setInvites(inviteRes.value.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, []);

  return (
    <div className="OperationsWrapper">
      <div className="TitleContainer">
        <h2>Overview</h2>
        <Primary href="/create-org" text="Create organisation" />
      </div>

      <div className="OrgaizationsList">
        <div className="InviteTitle">Existing organisations</div>
        {!loading && <OrganizationList orgs={orgs} />}
      </div>

      <div className="InvitesWrapper">
        <div className="InviteTitle">Invites</div>
        {!loading && <OrgInvites invites={invites} />}
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
