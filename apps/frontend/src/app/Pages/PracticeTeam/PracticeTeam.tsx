"use client";
import React, { useEffect, useState } from "react";
import "./PracticeTeam.css";
import { Col, Container, Row } from "react-bootstrap";
import Link from "next/link";
import { IoAddCircleOutline } from "react-icons/io5";
import StatCard from "@/app/Components/StatCard/StatCard";
import { HeadingDiv } from "../BusinessDashboard/BusinessDashboard";
import RoundCommonTabs from "@/app/Components/RoundCommonTabs/RoundCommonTabs";
import CardiologyTable from "@/app/Components/DataTable/CardiologyTable";
import ManageInviteTable from "@/app/Components/DataTable/ManageInviteTable";
import { getData } from "@/app/axios-services/services";
import { useOldAuthStore } from "@/app/stores/oldAuthStore";
import { convertFromFhirTeamMembers, fromFhirTeamOverview } from "@yosemite-crew/fhir";
import { TeamMember, TeamOverview } from "@yosemite-crew/types";
import { Button, Form } from "react-bootstrap";
import { LuSearch } from "react-icons/lu";

function toTitleCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function PracticeTeam() {
  const { userId } = useOldAuthStore();

  const [departmentWiseTeam, setDepartmentWiseTeam] = useState<Record<string, TeamMember[]> >({});

  const [Overview, setOverView] = useState<TeamOverview>({
    departmentCount: 0,
    totalWebUsers: 0,
    onDutyCount: 0,
    invitedCount: 0,
  });

  const [ManageInvites, setManageInvites] = useState(false);

  useEffect(() => {
    const getOverView = async () => {
      try {
        const response = await getData(
          `/fhir/v1/practiceTeamOverView?userId=${userId}`
        );
        if (response.status === 200) {
          console.log(response.data);
          const result: any = response.data;
          setOverView(fromFhirTeamOverview(result.data));
        }
      } catch (error) {
        console.log("Error fetching overview", error);
      }
    };

    getOverView();
  }, [userId]);

  useEffect(() => {
    const getPracticeTeamsList = async () => {
      try {
        const response = await getData(`/fhir/v1/practiceTeamsList?userId=${userId}`);
        if (response.status === 200) {
          const result: any = response.data;
          const { practitioners, roles }: any = result.response;
          const teamMembers = convertFromFhirTeamMembers(practitioners, roles);

          const groupedByDepartment: Record<string, TeamMember[]> = {};

          for (const member of teamMembers) {
            const dept = member.department?.trim() || "Unknown";
            if (!groupedByDepartment[dept]) {
              groupedByDepartment[dept] = [];
            }
            groupedByDepartment[dept].push(member);
          }

          setDepartmentWiseTeam(groupedByDepartment); // ✅ This sets state based on department
        }
      } catch (error) {
        console.error("Error fetching practice team list:", error);
        setDepartmentWiseTeam({}); // Reset to empty object on error
      }
    };

    getPracticeTeamsList();
  }, [userId]);

  const DepartmentTeam = ({ departmentName, teamList }: { departmentName: string; teamList: TeamMember[] }) => {
    const [localSearch, setLocalSearch] = useState("");

    // Filter by name only, ignoring role, with fallback to original list if empty
    const filteredMembers = teamList && teamList.length > 0
      ? teamList.filter((member) =>
          `${member.firstName} ${member.lastName}`.toLowerCase().includes(localSearch.toLowerCase())
        )
      : [];

    // Ensure uniqueRoles is handled safely
    const uniqueRoles = filteredMembers.length > 0
      ? [...new Set(filteredMembers.map((item) => item.role))]
      : [];

    const generateCardiologyTabs = (tabItems: any) => {
      if (!tabItems || tabItems.length === 0) {
        return [{ eventKey: "no-data", title: "No Data", content: <p>No members found</p> }];
      }
      return uniqueRoles.map((role: any) => ({
        eventKey: role,
        title: toTitleCase(role),
        content: <CardiologyTable data={tabItems.filter((item: any) => item.role === role)} />,
      }));
    };

    return (
      <Row key={departmentName}>
        <div className="TableItemsRow">
          <HeadingDiv Headname={toTitleCase(departmentName)} Headspan={teamList.length} />
          <div className="RightTopTbl">
            <Form className="Tblserchdiv" onSubmit={(e) => e.preventDefault()}>
              <input
                type="search"
                placeholder="Search Team Member"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
              />
              <Button type="submit">
                <LuSearch size={20} />
              </Button>
            </Form>
          </div>
          <RoundCommonTabs tabs={generateCardiologyTabs(filteredMembers)} showSearch={false} />
        </div>
      </Row>
    );
  };

  return (
    <>
      <section className="PracticeTeamSec">
        <Container>
          {!ManageInvites ? (
            <div className="PracticeTeamData">
              <div className="PracticeTopHead">
                <div className="leftPract">
                  <h2>
                    <span>Practice </span> Team
                  </h2>
                </div>
                <div className="RytPract">
                  <Link href="#" onClick={() => setManageInvites(true)}>
                    Manage Invites
                  </Link>
                  <Link href="/inviteteammembers" className="fill">
                    <IoAddCircleOutline size={20} /> Invite Practice Member
                  </Link>
                </div>
              </div>
              <div className="Teamoverview">
                <h5>Overview</h5>
                <Row>
                  <Col md={3}>
                    <StatCard
                      icon="solar:home-add-bold"
                      title="Specilities"
                      value={Overview.departmentCount}
                    />
                  </Col>
                  <Col md={3}>
                    <StatCard
                      icon="mingcute:user-2-fill"
                      title="Total Members"
                      value={Overview.totalWebUsers}
                    />
                  </Col>
                  <Col md={3}>
                    <StatCard
                      icon="carbon:checkmark-filled"
                      title="On-Duty"
                      value={Overview.onDutyCount}
                    />
                  </Col>
                  <Col md={3}>
                    <StatCard
                      icon="solar:letter-bold"
                      title="Members Invited"
                      value={Overview.invitedCount}
                    />
                  </Col>
                </Row>
              </div>
              {departmentWiseTeam && Object.keys(departmentWiseTeam).length > 0
                ? Object.entries(departmentWiseTeam).map(([departmentName, teamList]: any) => (
                    <DepartmentTeam key={departmentName} departmentName={departmentName} teamList={teamList} />
                  ))
                : <p>No departments available</p>}
            </div>
          ) : (
            <div className="ManageInvitesDiv">
              <div className="TopManagInvite">
                <h2>
                  Manage <span>Invites</span>
                </h2>
                <Link href="#" onClick={() => setManageInvites(false)}>
                  Manage Practice Teams
                </Link>
              </div>
              <div className="MangeInviteTableDiv">
                <ManageInviteTable />
              </div>
            </div>
          )}
        </Container>
      </section>
    </>
  );
}

export default PracticeTeam;