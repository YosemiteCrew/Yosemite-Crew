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
    <div className="flex flex-col gap-6 px-[60px] py-12">
      <div className="flex items-center justify-between w-full">
        <div className="text-text-primary text-heading-1">Overview</div>
        <Primary href="/create-org" text="Create organisation" />
      </div>

      <div className="flex flex-col gap-3">
        <div className="text-body-2 text-text-primary">
          Existing organisations{" "}
          <span className="text-text-tertiary">{" (" + orgs.length + ")"}</span>
        </div>
        <OrganizationList orgs={orgs} />
      </div>

      <div className="flex flex-col gap-3">
        <div className="text-body-2 text-text-primary">
          Invites<span className="text-text-tertiary">{" (" + invites.length + ")"}</span>
        </div>
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
