"use client";
import React, { useEffect, useState } from "react";
import "./DoctorDashboard.css";
import {
  Button,
  Col,
  Container,
  Dropdown,
  Form,
  Row,
  Tab,
  Tabs,
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

function DoctorDashboard() {
  const { vetAndTeamsProfile, userId, fetchVetAndTeamsProfile } =
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

  const [status, setStatus] = useState<string>("30 mins");

  const handleDropdownSelect = (eventKey: string | null) => {
    setStatus(eventKey as string);
  };

  


  
const image:any = vetAndTeamsProfile?.image ||
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
                <Link href="#" onClick={() => setAddNewLead(true)}>
                  <Image src="/Images/stact1.png" alt="stact1" width={24} height={24} /> Manage Appointment Slots
                </Link>
              </div>
            </div>
            <Row>
              <Col md={3}><StatCard icon="/Images/stact1.png" title="Appointments (Today)" value={158} /></Col>
              <Col md={3}><StatCard icon="/Images/stact2.png" title="Staff on-duty" value={122} /></Col>
              <Col md={3}><StatCard icon="/Images/stact3.png" title="Inventory Out-of-Stock" value={45} /></Col>
              <Col md={3}><StatCard icon="/Images/stact4.png" title="Revenue (Today)" value="$7,298" /></Col>
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
          <div className="DoctorAvailabilty">
            <h2>Appointment Slot Availability</h2>
           
            <div className="AvailabityDivDoctor">

              <div className="AvltyFor">
                <div className="avldate">
                  <h5>Availability for</h5>
                  <Form.Control
                    className="AvlDatepicker"
                    type="date"
                    id="appointmentDate"
                    title="Choose your date"
                  />
                </div>
                <div className="Avlswitch">
                  <p>Availability Status</p>
                  <div className="custom-toggle-container">
                    <label className="custom-switch">
                      <input
                        type="checkbox"
                        checked={available}
                        onChange={() => setAvailable(!available)}
                      />
                      <span className="slider" />
                    </label>
                    <span className={`status-text ${available ? "available" : "not-available"}`}>
                      {available ? "Available" : "Not Available"}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="appointselect">
                <div className="lft">
                  <h6>Set Appointment Duration</h6>
                  <p>Set the default time for appointments.</p>
                </div>
                <div className="ryt">
                  <Dropdown onSelect={handleDropdownSelect}>
                    <Dropdown.Toggle className="custom-status-dropdown" id="dropdown-status">
                      {status}
                    </Dropdown.Toggle>
                    <Dropdown.Menu>
                      {["15 mins", "30 mins", "45 mins", "60 mins"].map((opt) => (
                        <Dropdown.Item key={opt} eventKey={opt} active={status === opt}>
                          {opt}
                        </Dropdown.Item>
                      ))}
                    </Dropdown.Menu>
                  </Dropdown>
                </div>
              </div>

             

              <Button  className="updateBtn">
                Update <FaCircleCheck size={20} />
              </Button>


            </div>
           
              
           
          </div>
        )}
      </Container>
    </section>
  );
}

export default DoctorDashboard;