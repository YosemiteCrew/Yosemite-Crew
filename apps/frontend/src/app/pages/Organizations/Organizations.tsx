"use client";
import React, { useEffect, useState } from "react";
import { Button, Container } from "react-bootstrap";
import { useRouter } from "next/navigation";

import ProtectedRoute from "@/app/components/ProtectedRoute";
import { getData } from "@/app/services/axios";
import { HeadText } from "../CompleteProfile/CompleteProfile";
import OrgInvites from "../../components/DataTable/OrgInvites";
import OrganizationList from "../../components/DataTable/OrganizationList";

import "./Organizations.css";

const Organizations = () => {
  const router = useRouter();
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
      <Container>
        <div className="TitleContainer">
          <HeadText blktext="Organizations" Spntext="" />
          <div className="ComptBtn">
            <Button onClick={() => router.push("/complete-profile")}>
              Create New Organization
            </Button>
          </div>
        </div>

        <div className="OrgaizationsList">
          <div className="InviteTitle">Existing Organisations</div>
          {!loading && <OrganizationList orgs={orgs} />}
        </div>

        <div className="InvitesWrapper">
          <div className="InviteTitle">New Invites</div>
          {!loading && <OrgInvites invites={invites} />}
        </div>
      </Container>
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
