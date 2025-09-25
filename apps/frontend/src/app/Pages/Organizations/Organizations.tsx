"use client";
import React from "react";
import { Button, Container } from "react-bootstrap";

import { HeadText } from "../CompleteProfile/CompleteProfile";
import OrgInvites from "../../Components/DataTable/OrgInvites";
import OrganizationList from "../../Components/DataTable/OrganizationList";

import "./Organizations.css";
import { useRouter } from "next/navigation";

const Organizations = () => {
  const router = useRouter();

  return (
    <div className="OperationsWrapper">
      <Container>
        <div className="TitleContainer">
          <HeadText blktext="Organizations" Spntext="" />
          <div className="ComptBtn">
            <Button onClick={() => router.push("/CompleteProfile")}>Create New Organization</Button>
          </div>
        </div>

        <div className="InvitesWrapper">
          <div className="InviteTitle">New Invites</div>
          <OrgInvites />
        </div>

        <div className="OrgaizationsList">
          <div className="InviteTitle">Existing Organisations</div>
          <OrganizationList />
        </div>
      </Container>
    </div>
  );
};

export default Organizations;
