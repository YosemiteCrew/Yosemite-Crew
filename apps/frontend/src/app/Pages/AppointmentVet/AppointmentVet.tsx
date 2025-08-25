"use client";
import React, { useEffect, useState, useCallback } from "react";
import { Col, Container, Dropdown, Row } from "react-bootstrap";
import StatCard from "@/app/Components/StatCard/StatCard";
import TableTopBar from "@/app/Components/TableTopBar/TableTopBar";
import AppointmentsTable from "@/app/Components/DataTable/AppointmentsTable";
import UpComingAppointmentsTable from "@/app/Components/DataTable/UpComingAppointmentsTable";
import CompletedAppointmentsTable from "@/app/Components/DataTable/CompletedAppointmentsTable";
import Link from "next/link";
import { FaCalendar } from "react-icons/fa6";
import CalendarCard from "@/app/Components/CalendarCard/CalendarCard";
import { getData } from "@/app/axios-services/services";
import { useAuthStore } from "@/app/stores/authStore";
import TodayAppointments from "@/app/Components/DataTable/TodayAppointments";
import UpCommingAppointments from "@/app/Components/DataTable/UpCommingAppointments";
import NewAppointments from "@/app/Components/DataTable/NewAppointments";

type AppointmentStatus = "In-progress" | "Checked-In" | "Pending" | "accepted" | "fulfilled";

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
  status: AppointmentStatus;
};

interface ApiResponse {
  message: string;
  totalAppointments: number;
  Appointments: any[];
  pagination: {
    offset: number;
    limit: number;
    hasMore: boolean;
  };
}

function AppointmentVet() {
  const [selectedDoctor, setSelectedDoctor] = useState("Appointment Status");
  const [todayAppointmentsData, setTodayAppointmentsData] = useState<TodayAppointmentItem[]>([]);
  const [upcomingAppointmentsData, setUpcomingAppointmentsData] = useState<TodayAppointmentItem[]>([]);
  const [completedAppointmentsData, setCompletedAppointmentsData] = useState<TodayAppointmentItem[]>([]);
  const [newAppointmentsData, setNewAppointmentsData] = useState<TodayAppointmentItem[]>([]);
  const [overviewStats, setOverviewStats] = useState({
    todaysAppointments: 0,
    upcomingAppointments: 0,
    completedAppointments: 0,
    newAppointments: 0
  });
  const [myCalender, setMyCalender] = useState([]);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const userId = useAuthStore((state: any) => state.userId);

  // Fetch all appointment data
  const fetchAppointments = useCallback(async (type: "today" | "upcoming" | "completed" | "new") => {
    try {
      const response = await getData(
        `/fhir/v1/getAllAppointmentsToAction?userId=${userId}&type=${type}&limit=1000`
      );
      
      if (response.status === 200) {
        const data: any = response.data;
        
        // Update overview stats
        setOverviewStats(prev => ({
          ...prev,
          [`${type}Appointments`]: data.totalAppointments
        }));

        // Normalize and set the data
        const normalizedData = normalizeAppointments(data.Appointments);
        
        switch (type) {
          case "today":
            setTodayAppointmentsData(normalizedData);
            break;
          case "upcoming":
            setUpcomingAppointmentsData(normalizedData);
            break;
          case "completed":
            setCompletedAppointmentsData(normalizedData);
            break;
          case "new":
            setNewAppointmentsData(normalizedData);
            break;
        }

        return data.totalAppointments;
      }
    } catch (error) {
      console.error(`Error fetching ${type} appointments:`, error);
      return 0;
    }
  }, [userId]);

  // Fetch all appointment types
  const fetchAllAppointments = useCallback(async () => {
    if (!userId) return;

    try {
      const [todayCount, upcomingCount, completedCount, newCount] = await Promise.all([
        fetchAppointments("today"),
        fetchAppointments("upcoming"),
        fetchAppointments("completed"),
        fetchAppointments("new")
      ]);

      // Update overview stats with all counts
      setOverviewStats({
        todaysAppointments: todayCount || 0,
        upcomingAppointments: upcomingCount || 0,
        completedAppointments: completedCount || 0,
        newAppointments: newCount || 0
      });
    } catch (error) {
      console.error("Error fetching all appointments:", error);
    }
  }, [fetchAppointments, userId]);

  const handleAppointmentUpdate = useCallback(() => {
    // Refresh all appointments to reflect the status changes
    fetchAllAppointments();
  }, [fetchAllAppointments]);

  useEffect(() => {
    fetchAllAppointments();
  }, [fetchAllAppointments, refreshCounter]);

  const normalizeAppointments = (appointments: any[]): TodayAppointmentItem[] => {
    return appointments.map((item: any) => {
      // Map backend status to frontend status
      let mappedStatus: AppointmentStatus = "Pending";
      if (item.appointmentStatus === "accepted") {
        mappedStatus = "Checked-In";
      } else if (item.appointmentStatus === "fulfilled") {
        mappedStatus = "In-progress";
      } else if (item.appointmentStatus === "pending") {
        mappedStatus = "Pending";
      }

      return {
        id: item._id,
        name: item.petName,
        owner: item.ownerName,
        image: item.petImage || "/default-pet.png",
        tokenNumber: item.tokenNumber,
        reason: item.purposeOfVisit,
        petType: item.pet,
        pet: item.breed,
        time: item.appointmentTime,
        date: item.appointmentDate,
        participants: { name: item.doctorName || "Unknown Doctor" },
        specialization: item.departmentName,
        status: mappedStatus,
      };
    });
  };

  return (
    <>
      <section className="AppointmentVetSection">
        <Container>
          <div className="AppointmentVetData">
            <div className="TopAppontVet">
              <div className="ApointHead">
                <h2>Appointment Management</h2>
                <span>No New Appointments</span>
              </div>
              <div className="sss">
                <h6>Overview</h6>
                <Row>
                  <Col md={3}>
                    <StatCard
                      icon="solar:document-medicine-bold"
                      title="Appointments (Today)"
                      value={overviewStats.todaysAppointments}
                    />
                  </Col>
                  <Col md={3}>
                    <StatCard
                      icon="solar:calendar-add-bold"
                      title="Upcoming"
                      value={overviewStats.upcomingAppointments}
                    />
                  </Col>
                  <Col md={3}>
                    <StatCard
                      icon="carbon:checkmark-filled"
                      title="Completed"
                      value={overviewStats.completedAppointments}
                    />
                  </Col>
                  <Col md={3}>
                    <StatCard
                      icon="solar:star-bold"
                      title="New Appointments"
                      value={overviewStats.newAppointments}
                    />
                  </Col>
                </Row>
              </div>
            </div>

            <Row>
              <div className="TableRowDiv">
                <TableTopBar 
                  TbleHName="Today's Appointments" 
                  TbleHNumb={todayAppointmentsData.length.toString()} 
                />
                <TodayAppointments data={todayAppointmentsData} onAppointmentUpdate={handleAppointmentUpdate} />
              </div>
            </Row>

            <Row>
              <div className="TableRowDiv">
                <TableTopBar 
                  TbleHName="Upcoming Appointments" 
                  TbleHNumb={upcomingAppointmentsData.length.toString()} 
                />
                <UpCommingAppointments data={upcomingAppointmentsData} onAppointmentUpdate={handleAppointmentUpdate} />
              </div>
            </Row>

            <Row>
              <div className="TableRowDiv">
                <TableTopBar
                  TbleHName="Completed Appointments"
                  TbleHNumb={completedAppointmentsData.length.toString()}
                />
                <CompletedAppointmentsTable data={completedAppointmentsData} onAppointmentUpdate={handleAppointmentUpdate} />
              </div>
            </Row>

            <Row>
              <div className="TableRowDiv">
                <TableTopBar
                  TbleHName="New Appointments"
                  TbleHNumb={newAppointmentsData.length.toString()}
                />
                <NewAppointments 
                  data={newAppointmentsData} 
                  onAppointmentUpdate={handleAppointmentUpdate}
                />
              </div>
            </Row>

            <Row>
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
                <CalendarCard data={myCalender}/>
              </div>
            </Row>
          </div>
        </Container>
      </section>
    </>
  );
}

export default AppointmentVet;