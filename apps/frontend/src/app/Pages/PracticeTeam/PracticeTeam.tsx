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
import { useAuthStore } from "@/app/stores/authStore";
import { convertFromFhirTeamMembers, fromFhirTeamOverview } from "@yosemite-crew/fhir";
import { TeamMember, TeamOverview } from "@yosemite-crew/types";
import { Icon } from "@iconify/react/dist/iconify.js";

function PracticeTeam() {
  const { userId } = useAuthStore();

  const [departmentWiseTeam, setDepartmentWiseTeam] = useState<TeamMember | [] | any>([]);

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

          const result: any = response.data
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
      }
    };

    getPracticeTeamsList();
  }, [userId]);


  // useEffect(() => {
  //   const departmentRoleMap: Record<string, Record<string, TeamMember[]>> = {};

  //   Object.entries(departmentWiseTeam).forEach(([department, members]) => {
  //     departmentRoleMap[department] = {};

  //     members.forEach((member) => {
  //       const role = member.role || "Other";
  //       if (!departmentRoleMap[department][role]) {
  //         departmentRoleMap[department][role] = [];
  //       }
  //       departmentRoleMap[department][role].push(member);
  //     });
  //   });

  //   setRolesByDepartment(departmentRoleMap);
  // }, [departmentWiseTeam]);


  const generateCardiologyTabs = (tabItems: any) => {
    return tabItems.map((item: any) => ({
      eventKey: item.role,
      title: item.role,
      content: <CardiologyTable data={tabItems} />,
    }));
  };
  console.log(departmentWiseTeam, "departmentWiseTeam")
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
              {departmentWiseTeam &&
                Object.entries(departmentWiseTeam).map(([departmentName, teamList]: any, i) => {
                  return (
                    <Row key={i}>
                      <div className="TableItemsRow">
                        <HeadingDiv Headname={departmentName} Headspan={teamList.length} />
                        <RoundCommonTabs
                          tabs={generateCardiologyTabs(
                            teamList
                          )}
                          showSearch
                        />
                      </div>
                    </Row>
                  );
                })}
            </div>
          ) : (
            <div className="ManageInvitesDiv">
              <div className="TopManagInvite">
                <h2>
                  Manage <span>Invites</span>
                </h2>
                <Link href="#">Manage Practice Teams</Link>
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
