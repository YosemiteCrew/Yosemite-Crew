"use client";
import React, { useEffect, useState } from "react";
import "./DoctorDashboard.css";
import {
  Col,
  Container,
  Row,
} from "react-bootstrap";
import Image from "next/image";
import Link from "next/link";
import StatCard from "@/app/Components/StatCard/StatCard";
import { HeadingDiv } from "../BusinessDashboard/BusinessDashboard";
import EmergencyAppointmentsTable from "@/app/Components/DataTable/EmergencyAppointmentsTable";
import { FaCalendar, FaCircleCheck } from "react-icons/fa6";
import CalendarCard from "@/app/Components/CalendarCard/CalendarCard";
import { useAuthStore } from "@/app/stores/authStore";
import { putData } from "@/app/axios-services/services";
import Swal from "sweetalert2";



import DoctorSlots from "./DoctorSlots";

function DoctorDashboard() {
  const { vetAndTeamsProfile, userId, fetchVetAndTeamsProfile, userType } =
    useAuthStore();

  const [available, setAvailable] = useState(true);
  const [addNewLead, setAddNewLead] = useState(false);
  useEffect(() => {
    setAvailable(vetAndTeamsProfile?.name.status === "On-Duty" ? true : false);
  }, [vetAndTeamsProfile]);

  const updateAvailability = async () => {
    const status = available ? "Off-Duty" : "On-Duty";
    try {
      const response = await putData(
        `/fhir/v1/updateAvailability?userId=${userId}&status=${status}`
      );
      if (response.status === 200) {
        Swal.fire({
          icon: "success",
          title: "Update Status!",
          text: "The Status has Updated.",
          timer: 2000,
          showConfirmButton: false,
        });
      }
      await fetchVetAndTeamsProfile(userId as string);
    } catch (error) {
      console.log("error");
    }
  };

  const image: any = vetAndTeamsProfile?.image ||
    "https://images.unsplash.com/photo-1633332755192-727a05c4013d?q=80&w=880&auto=format&fit=crop"
  return (
    <section className="doctor-dashboard-Sec">
      <Container>
        {!addNewLead ? (
          <div className="DoctorDashboardData">
            <div className="TopDoctorDashboard">
              <div className="LeftDash">
                <Image
                  src={image}
                  alt=""
                  width={80}
                  height={80}
                />
                <div className="DoctorName">
                  <p>
                    Welcome, Dr. {`${vetAndTeamsProfile?.name.firstName} ${vetAndTeamsProfile?.name.lastName}`}
                  </p>
                  <h2>Your Dashboard</h2>
                </div>
              </div>
              <div className="RightDash">
                <p>Availability Status</p>
                <div className="custom-toggle-container">
                  <label className="custom-switch">
                    <input
                      type="checkbox"
                      checked={available}
                      onChange={updateAvailability}
                    />
                    <span className="slider" />
                  </label>
                  <span className={`status-text ${available ? "available" : "not-available"}`}>
                    {available ? "Available" : "Not Available"}
                  </span>
                </div>
                {userType === "vet" ? <Link href="#" onClick={() => setAddNewLead(true)}>
                  <Image src="/Images/stact1.png" alt="stact1" width={24} height={24} /> Manage Appointment Slots
                </Link> : ""}
              </div>
            </div>
            <Row>
              <Col md={3}><StatCard icon="solar:calendar-mark-bold" title="Emergency Appointment" value={158} /></Col>
              <Col md={3}><StatCard icon="solar:document-medicine-bold" title="Today’s Appointment" value={122} /></Col>
              <Col md={3}><StatCard icon="solar:clipboard-check-bold" title="Assessments" value={45} /></Col>
              <Col md={3}><StatCard icon="solar:calendar-add-bold" title="Calender View" value="$7,298" /></Col>
            </Row>
            {["Emergency Appointments", "Today’s Appointments", "Assessment"].map((title, i) => (
              <Row key={i}>
                <div className="TableItemsRow">
                  <HeadingDiv Headname={title} Headspan="03" />
                  <EmergencyAppointmentsTable />
                </div>
              </Row>
            ))}
            <div className="DoctorClender">
              <div className="TopClendr">
                <div className="lftclndr">
                  <h3>My Calendar <span>(14)</span></h3>
                </div>
                <div className="Rytclndr">
                  <div className="clnderBtn">
                    <Link href="#"><FaCalendar /> View Calendar</Link>
                  </div>
                </div>
              </div>
              <CalendarCard />
            </div>
          </div>
        ) : (
          <DoctorSlots />
        )}
      </Container>
    </section>
  );
}

export default DoctorDashboard;