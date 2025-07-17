"use client";
import React, {  useState } from "react";
import "./DoctorDashboard.css";
import { Button, Col, Container, Dropdown, Form, Row, Tab, Tabs } from "react-bootstrap";
import Image from "next/image";
import Link from "next/link";
import StatCard from "@/app/Components/StatCard/StatCard";
import { HeadingDiv } from "../BusinessDashboard/BusinessDashboard";
import EmergencyAppointmentsTable from "@/app/Components/DataTable/EmergencyAppointmentsTable";
import { FaCalendar, FaCircleCheck } from "react-icons/fa6";
import CalendarCard from "@/app/Components/CalendarCard/CalendarCard";




function DoctorDashboard() {
  const [available, setAvailable] = useState(true);
  const [addNewLead, setAddNewLead] = useState(false);

  // selected 
  const [status, setStatus] = useState<string>('30 mins');
    // const handleDropdownSelect = (eventKey: string | null) => {
    //   if (eventKey) setStatus(eventKey);
    // };
  // selected 

  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [unavailableSlots, setUnavailableSlots] = useState<string[]>([]);
  const [selectUnavailable, setSelectUnavailable] = useState(false);
  const handleDropdownSelect = (eventKey: string | null) => {
    setStatus(eventKey as string);
  };

  const handleSlotClick = (slot: string) => {
    if (selectUnavailable) {
      setUnavailableSlots((prev) =>
        prev.includes(slot)
          ? prev.filter((s) => s !== slot)
          : [...prev, slot]
      );
    } else {
      setSelectedSlots((prev) =>
        prev.includes(slot)
          ? prev.filter((s) => s !== slot)
          : [...prev, slot]
      );
    }
  };

  const handleUpdate = () => {
    console.log("Selected Slots:", selectedSlots);
    console.log("Unavailable Slots:", unavailableSlots);
    // Add your API call here
  };

  const timeSlots = [
    "10:30 AM", "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM", "01:00 PM",
    "01:30 PM", "02:00 PM", "02:30 PM", "03:00 PM", "04:00 PM",
    "03:30 PM", "04:30 PM", "05:00 PM", "05:30 PM", "06:00 PM",
    "06:30 PM", "07:00 PM", "07:30 PM", "08:00 PM", "08:30 PM",
  ];






  return (
    <>
      <section className="doctor-dashboard-Sec">
        <Container>
          {!addNewLead ? (
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
                <Link href="#" onClick={() => setAddNewLead(true)}><Image src="/Images/stact1.png" alt="stact1" width={24} height={24} /> Manage Appointment Slots</Link>
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

           ) : ( 
            
            <div className="DoctorAvailabilty">
              <h2>Appointment Slot Availability</h2>
              <div className="Add_Profile_Data">
                <div className="LeftProfileDiv">

                  <div className="AvailabityDivDoctor">

                    <div className="AvltyFor">
                      <div className="avldate">
                        <h5>Availability for</h5>
                        <Form.Control className="AvlDatepicker" type="date" id="appointmentDate" title="Choose your date" />
                      </div>
                      <div className="Avlswitch">
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
                      </div>
                    </div>

                    <div className="ss">
                      <Tabs defaultActiveKey="profile" id="uncontrolled-tab-example" className="mb-3" >
                        <Tab eventKey="home" title="Daily">
                          Tab content for Home
                        </Tab>
                        <Tab eventKey="profile" title="Mon-Fri">
                          Tab content for Profile
                        </Tab>
                        <Tab eventKey="contact" title="Contact" disabled>
                          Tab content for Contact
                        </Tab>
                      </Tabs>




                    </div>

                    


                    <div className="appointselect">
                      <div className="lft">
                        <h6>Set Appointment Duration</h6>
                        <p>Set the default time for appointments.</p>
                      </div>
                      <div className="ryt">
                        <div className="StatusSelect">
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
                    </div>
                    <div className="selectTimeSection">
                      <div className="selecttime">
                        <p>Select Time</p>
                        <Form.Check
                          type="checkbox"
                          label="Select Unavailable Slots"
                          checked={selectUnavailable}
                          onChange={() => setSelectUnavailable(!selectUnavailable)}
                        />
                      </div>
                      <div className="timeSlots">
                        {timeSlots.map((slot) => {
                          const isSelected = selectedSlots.includes(slot);
                          const isUnavailable = unavailableSlots.includes(slot);
                          const isDisabled = isUnavailable && !selectUnavailable;

                          let className = "timeSlot";
                          if (isSelected) className += " selected";
                          if (isUnavailable) className += " unavailable";
                          if (isDisabled) className += " disabled";

                          return (
                            <button
                              key={slot}
                              className={className}
                              disabled={isDisabled}
                              onClick={() => handleSlotClick(slot)}
                            >
                              {slot}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <Button onClick={handleUpdate} className="updateBtn"> Update <FaCircleCheck size={20}/></Button>
                  </div>



                </div>



                <div className="RytProfileDiv"></div>

              </div>

            </div>

            
          )}

        </Container>
      </section>
    </>
  );
}

export default DoctorDashboard;
