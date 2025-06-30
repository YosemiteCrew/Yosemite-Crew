"use client";
import React, { useState } from "react";
import "./DoctorDashboard.css";
import { Col, Container, Row } from "react-bootstrap";
import Image from "next/image";
import Link from "next/link";
import { IoMdEye } from "react-icons/io";
import StatCard from "@/app/Components/StatCard/StatCard";
import { HeadingDiv } from "../BusinessDashboard/BusinessDashboard";
import EmergencyAppointmentsTable from "@/app/Components/DataTable/EmergencyAppointmentsTable";
import { FaCalendar } from "react-icons/fa6";
import CalendarCard from "@/app/Components/CalendarCard/CalendarCard";



function DoctorDashboard() {
  const [available, setAvailable] = useState(true);
  return (
    <>
      <section className="doctor-dashboard-Sec">
        <Container>
          <div className="DoctorDashboardData">


            <div className="TopDoctorDashboard">
              <div className="LeftDash">
                <Image src="https://images.unsplash.com/photo-1633332755192-727a05c4013d?q=80&w=880&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="" width={80} height={80} />
                <div className="DoctorName">
                  <p>Welcome, Dr. David Brown</p>
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
                      onChange={() => setAvailable((prev) => !prev)}
                    />
                    <span className="slider" />
                  </label>
                  <span
                    className={`status-text ${
                      available ? "available" : "not-available"
                    }`}
                  >
                    {available ? "Available" : "Not Available"}
                  </span>
                </div>
                <Link href="#"><IoMdEye /> Manage Availability</Link>
              </div>


            </div>
            <Row>
                <Col md={3}><StatCard icon="/Images/stact1.png" title="Appointments (Today)" value={158} /></Col>
                <Col md={3}><StatCard icon="/Images/stact2.png" title="Staff on-duty" value={122} /></Col>
                <Col md={3}><StatCard icon="/Images/stact3.png" title="Inventory Out-of-Stock" value={45} /></Col>
                <Col md={3}><StatCard icon="/Images/stact4.png" title="Revenue (Today)" value="$7,298" /></Col>
            </Row>

            <Row>
              <div className="TableItemsRow">
                <HeadingDiv Headname="Emergency Appointments " Headspan="03" />
                <EmergencyAppointmentsTable/>
              </div>
            </Row>
            <Row>
              <div className="TableItemsRow">
                <HeadingDiv Headname="Today’s Appointments " Headspan="03" />
                <EmergencyAppointmentsTable/>
              </div>
            </Row>
            <Row>
              <div className="TableItemsRow">
                <HeadingDiv Headname="Assessment" Headspan="01" />
                <EmergencyAppointmentsTable/>
              </div>
            </Row>
            
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
                <CalendarCard/>
            </div>







          </div>
        </Container>
      </section>
    </>
  );
}

export default DoctorDashboard;
