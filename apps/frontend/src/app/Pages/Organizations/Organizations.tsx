"use client";
import React from "react";
import { Button, Container } from "react-bootstrap";
import { useRouter } from "next/navigation";

import ProtectedRoute from "@/app/Components/ProtectedRoute";
import { HeadText } from "../CompleteProfile/CompleteProfile";
import OrgInvites from "../../Components/DataTable/OrgInvites";
import OrganizationList from "../../Components/DataTable/OrganizationList";

import "./Organizations.css";

const Organizations = () => {
  const router = useRouter();

  return (
    <div className="OperationsWrapper">
      <Container>
        <div className="TitleContainer">
          <HeadText blktext="Organizations" Spntext="" />
          <div className="ComptBtn">
            <Button onClick={() => router.push("/completeprofile")}>
              Create New Organization
            </Button>
          </div>
        </div>

        <div className="OrgaizationsList">
          <div className="InviteTitle">Existing Organisations</div>
          <OrganizationList />
        </div>

        <div className="InvitesWrapper">
          <div className="InviteTitle">New Invites</div>
          <OrgInvites />
        </div>
      </Container>
    </div>
  );
};

export default function ProtectedOrganizations() {
  return (
    <ProtectedRoute>
      <Organizations />
    </ProtectedRoute>
  );
}
