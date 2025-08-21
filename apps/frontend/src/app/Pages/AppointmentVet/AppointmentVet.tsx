"use client";
import React, { useEffect, useState } from "react";
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
import { convertAppointmentStatsFromFHIR, convertFromFHIRAppointments, fromFHIR } from "@yosemite-crew/fhir";
import { FHIRAppointmentData, MyAppointmentData } from "@yosemite-crew/types";
type AppointmentStatus = "In-progress" | "Checked-In" | "Pending";

export type TodayAppointmentItem = {
  name: string;
  owner: string;
  image: string;
  tokenNumber: string;
  reason: string;
  petType: string;
  time: string;
  date: string;
  participants: { name: string };
  specialization: string;
  status: AppointmentStatus;
};


function AppointmentVet() {
  const [selectedDoctor, setSelectedDoctor] = useState("Appointment Status");
  const [todayAppointmentsData, setTodayAppointmentsData] = useState<TodayAppointmentItem[]>([]);
  const [overviewStats, setOverviewStats] = useState<any>([]);
  const [upcomingAppointmentsData, setUpcomingAppointmentsData] = useState<TodayAppointmentItem[]>([]);
  const [completedAppointmentsData, setCompletedAppointmentsData] = useState<TodayAppointmentItem[]>(
    []
  );
  console.log("todayAppointmentsData",todayAppointmentsData)
  const [myCalender, setMyCalender] = useState([]);
  const userId = useAuthStore((state: any) => state.userId);

  
  useEffect(() => {
    fetchCalenderAppointments("calenderaAppointment");
  }, []);
  useEffect(() => {
    fetchOverviewStats();
  }, []);

  
  const fetchCalenderAppointments = async (type: any) => {
    const response = await getData("/fhir/v1/Appointment", {
      caseType: type,
      organization: userId,
    });
    if (!response) {
      throw new Error("Network response was not ok");
    }
    const data: any = await response.data;
    // console.log(data, "DATAAAAAAAAAAAAAAAA");
    // const convertToJson: any = await convertFhirAppointmentBundle(
    //   data.data.entry
    // );

    if (type === "calenderaAppointment") {
       const json:any = convertFromFHIRAppointments(data)
      setMyCalender(json);
    }
  };
useEffect(() => {
    const getTodayAppointment = async (doctorId: string, status: string) => {
      try {
        const response = await getData(
          `/api/appointments/getAllAppointments?doctorId=${doctorId}&userId=${userId}&status=${status}`
        );
        if (response.status === 200) {
          const data: any = response.data;
          setTodayAppointmentsData(normalizeAppointments(fromFHIR(data.data as FHIRAppointmentData[])));
        }
      } catch (error) {
        console.error(error);
      }
    };
    if (userId) {
      getTodayAppointment("", "");
    }
  }, [userId]);
useEffect(() => {
    const getUpCommingAppointment = async (doctorId: string, status: string) => {
      try {
        const response = await getData(
          `/api/appointments/getAllAppointmentsUpComming?doctorId=${doctorId}&userId=${userId}&status=${status}`
        );
        if (response.status === 200) {
          const data: any = response.data;
          setUpcomingAppointmentsData(normalizeAppointments(fromFHIR(data.data as FHIRAppointmentData[])));
        }
      } catch (error) {
        console.error(error);
      }
    };
    if (userId) {
      getUpCommingAppointment("", "");
    }
  }, [userId]);


  useEffect(() => {
  const getCompletedAppointments = async (doctorId: string, status: string) => {
    try {
      const response = await getData(
        `/api/appointments/getAllAppointmentsUpComming?doctorId=${doctorId}&userId=${userId}&status=fulfilled`
      );
      if (response.status === 200) {
        const data: any = response.data;
        setCompletedAppointmentsData(
          normalizeAppointments(fromFHIR(data.data as FHIRAppointmentData[]))
        );
      }
    } catch (error) {
      console.error(error);
    }
  };
  if (userId) {
    getCompletedAppointments("", "fulfilled");
  }
}, [userId]);


const fetchOverviewStats = async() => { 
  console.log("First Name");
  const response = await getData("/fhir/v1/AppointmentOverviewStats", {
    userId: userId,
  });
  if (!response) {
    throw new Error("Network response was not ok");
  }
  const data: any = await convertAppointmentStatsFromFHIR
  (response.data)
 console.log(data,"Overview Stats Data");
setOverviewStats(data);

  
 }
  const normalizeAppointments = (data: MyAppointmentData[]): TodayAppointmentItem[] => {
  return data.map((item:any) => {
    // map raw backend status → union type
    let mappedStatus: AppointmentStatus = "Pending";
    if (item.appointmentStatus.toLowerCase() === "in-progress") {
      mappedStatus = "In-progress";
    } else if (item.appointmentStatus.toLowerCase() === "checked-in") {
      mappedStatus = "Checked-In";
    }

    return {
      id: item._id,
      name: item.petName,
      owner: item.ownerName,
      image: item.petImage,
      tokenNumber: item.tokenNumber,
      reason: item.purposeOfVisit,
      petType: item.breed,
      pet: item.pet,
      time: item.appointmentTime,
      date: item.appointmentDate,
      participants: { name: item.doctorName },
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
                      icon="/Images/stact1.png"
                      title="Appointments (Today)"
                      value={overviewStats.todaysAppointments || 0}
                    />
                  </Col>
                  <Col md={3}>
                    <StatCard
                      icon="/Images/stact2.png"
                      title="Upcoming"
                      value={overviewStats.upcomingAppointments}
                    />
                  </Col>
                  <Col md={3}>
                    <StatCard
                      icon="/Images/stact3.png"
                      title="Completed"
                      value={overviewStats.completedAppointments}
                    />
                  </Col>
                  <Col md={3}>
                    <StatCard
                      icon="/Images/stact4.png"
                      title="New Appointments"
                      value={overviewStats.newAppointments}
                    />
                  </Col>
                </Row>
              </div>
            </div>

            <Row>
              <div className="TableRowDiv">
                <TableTopBar TbleHName="Today’s Assessments" TbleHNumb="03" />
                <AppointmentsTable data={todayAppointmentsData} />
              </div>
            </Row>

            <Row>
              <div className="TableRowDiv">
                <TableTopBar TbleHName="Upcoming Appointments" TbleHNumb="03" />
                <UpComingAppointmentsTable data={upcomingAppointmentsData} />
              </div>
            </Row>

            <Row>
              <div className="TableRowDiv">
                <TableTopBar
                  TbleHName="Completed Appointments"
                  TbleHNumb="03"
                />
                <CompletedAppointmentsTable data={completedAppointmentsData} />
              </div>
            </Row>
            <Row>
              <div className="DoctorClender">
                <div className="TopClendr">
                  <div className="lftclndr">
                    <h3>
                      My Calendar <span>(14)</span>
                    </h3>
                  </div>
                  <div className="Rytclndr">
                    <div className="clnderSlect">
                      <Dropdown
                        onSelect={(val: any) =>
                          setSelectedDoctor(val || "Doctor")
                        }
                      >
                        <Dropdown.Toggle id="doctor-dropdown">
                          {selectedDoctor}
                        </Dropdown.Toggle>
                        <Dropdown.Menu>
                          <Dropdown.Item eventKey="Active">
                            Active
                          </Dropdown.Item>
                          <Dropdown.Item eventKey="Cancel">
                            Cancel
                          </Dropdown.Item>
                          <Dropdown.Item eventKey="Complete">
                            Complete
                          </Dropdown.Item>
                          <Dropdown.Item eventKey="Pending">
                            Pending
                          </Dropdown.Item>
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
            </Row>I
          </div>
        </Container>
      </section>
    </>
  );
}

export default AppointmentVet;
