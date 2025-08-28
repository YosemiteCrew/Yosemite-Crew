"use client";
import React, { useState, useCallback } from "react";
import { Col, Container, Dropdown, Row } from "react-bootstrap";
import StatCard from "@/app/Components/StatCard/StatCard";
import TableTopBar from "@/app/Components/TableTopBar/TableTopBar";
// import Link from "next/link";
// import { FaCalendar } from "react-icons/fa6";
// import CalendarCard from "@/app/Components/CalendarCard/CalendarCard";
import { useAuthStore } from "@/app/stores/authStore";
import TodayAppointments from "@/app/Components/DataTable/TodayAppointments";
import UpCommingAppointments from "@/app/Components/DataTable/UpCommingAppointments";
import CompletedAppointmentsTable from "@/app/Components/DataTable/CompletedAppointmentsTable";
import NewAppointments from "@/app/Components/DataTable/NewAppointments";

export type TodayAppointmentItem = {
  id: string;
  name: string;
  owner: string;
  image: string;
  tokenNumber: string;
  reason: string;
  petType: string;
  pet: string;
  time: string;
  date: string;
  participants: { name: string };
  specialization: string;
  status: string;
};

function AppointmentVet() {
  const [selectedDoctor, setSelectedDoctor] = useState("Appointment Status");
  const [myCalender, setMyCalender] = useState([]);
  const userId = useAuthStore((state: any) => state.userId);

  // State to store counts from each table
  const [todayCount, setTodayCount] = useState(0);
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [refreshTimestamp, setRefreshTimestamp] = useState(Date.now());

  // Create a refresh function that updates the timestamp
  const refreshAllTables = useCallback(() => {
    setRefreshTimestamp(Date.now());
  }, []);

  return (
    <>
      <section className="AppointmentVetSection">
        <Container>
          <div className="AppointmentVetData">
            <div className="TopAppontVet">
              <div className="ApointHead">
                <h2>Appointment Management</h2>
                <span>{todayCount? `${todayCount} ${"New Appointments"}`:"No New Appointments"}</span>
              </div>
              <div className="sss">
                <h6>Overview</h6>
                <Row>
                  <Col md={3}>
                    <StatCard
                      icon="solar:document-medicine-bold"
                      title="Appointments (Today)"
                      value={todayCount}
                    />
                  </Col>
                  <Col md={3}>
                    <StatCard
                      icon="solar:calendar-add-bold"
                      title="Upcoming"
                      value={upcomingCount}
                    />
                  </Col>
                  <Col md={3}>
                    <StatCard
                      icon="carbon:checkmark-filled"
                      title="Completed"
                      value={completedCount}
                    />
                  </Col>
                  <Col md={3}>
                    <StatCard
                      icon="solar:star-bold"
                      title="New Appointments"
                      value={newCount}
                    />
                  </Col>
                </Row>
              </div>
            </div>

            <Row>
              <div className="TableRowDiv">
                <TableTopBar
                  TbleHName="Today's Appointments"
                  TbleHNumb={todayCount.toString()}
                />
                <TodayAppointments
                  userId={userId}
                  onAppointmentUpdate={refreshTimestamp}
                  onCountUpdate={setTodayCount}
                  onRefreshAll={refreshAllTables} // Pass the refresh function
                />
              </div>
            </Row>

            <Row>
              <div className="TableRowDiv">
                <TableTopBar
                  TbleHName="Upcoming Appointments"
                  TbleHNumb={upcomingCount.toString()}
                />
                <UpCommingAppointments
                  userId={userId}
                  onAppointmentUpdate={refreshTimestamp}
                  onCountUpdate={setUpcomingCount}
                  onRefreshAll={refreshAllTables} // Pass the refresh function
                />
              </div>
            </Row>

            <Row>
              <div className="TableRowDiv">
                <TableTopBar
                  TbleHName="Completed Appointments"
                  TbleHNumb={completedCount.toString()}
                />
                <CompletedAppointmentsTable
                  userId={userId}
                  onAppointmentUpdate={refreshTimestamp}
                  onCountUpdate={setCompletedCount}
                  onRefreshAll={refreshAllTables} // Pass the refresh function
                />
              </div>
            </Row>

            <Row>
              <div className="TableRowDiv">
                <TableTopBar
                  TbleHName="New Appointments"
                  TbleHNumb={newCount.toString()}
                />
                <NewAppointments
                  userId={userId}
                  onAppointmentUpdate={refreshTimestamp}
                  onCountUpdate={setNewCount}
                  onRefreshAll={refreshAllTables} // Pass the refresh function
                />
              </div>
            </Row>

            {/* <Row>
              <div className="DoctorClender">
                <div className="TopClendr">
                  <div className="lftclndr">
                    <h3>
                      My Calendar <span>({myCalender.length})</span>
                    </h3>
                  </div>
                  <div className="Rytclndr">
                    <div className="clnderSlect">
                      <Dropdown
                        onSelect={(val: any) =>
                          setSelectedDoctor(val || "Appointment Status")
                        }
                      >
                        <Dropdown.Toggle id="doctor-dropdown">
                          {selectedDoctor}
                        </Dropdown.Toggle>
                        <Dropdown.Menu>
                          <Dropdown.Item eventKey="Active">Active</Dropdown.Item>
                          <Dropdown.Item eventKey="Cancel">Cancel</Dropdown.Item>
                          <Dropdown.Item eventKey="Complete">Complete</Dropdown.Item>
                          <Dropdown.Item eventKey="Pending">Pending</Dropdown.Item>
                        </Dropdown.Menu>
                      </Dropdown>
                    </div>

                    <div className="clnderBtn">
                      <Link href="#">
                        <FaCalendar /> View Calendar
                      </Link>
                    </div>
                  </div>
                </div>
                <CalendarCard data={myCalender} />
              </div>
            </Row> */}
          </div>
        </Container>
      </section>
    </>
  );
}

export default AppointmentVet;