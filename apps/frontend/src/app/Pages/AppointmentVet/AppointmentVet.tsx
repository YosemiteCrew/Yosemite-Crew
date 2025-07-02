"use client";
import React, { useState } from 'react'
import { Col, Container, Dropdown, Row } from 'react-bootstrap'
import StatCard from '@/app/Components/StatCard/StatCard'
import TableTopBar from '@/app/Components/TableTopBar/TableTopBar'
import AppointmentsTable from '@/app/Components/DataTable/AppointmentsTable'
import UpComingAppointmentsTable from '@/app/Components/DataTable/UpComingAppointmentsTable';
import CompletedAppointmentsTable from '@/app/Components/DataTable/CompletedAppointmentsTable';
import Link from 'next/link';
import { FaCalendar } from 'react-icons/fa6';
import CalendarCard from '@/app/Components/CalendarCard/CalendarCard';

function AppointmentVet() {
      const [selectedDoctor, setSelectedDoctor] = useState("Appointment Status");
  return (
    <>

    <section className='AppointmentVetSection'>
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
                            <Col md={3}><StatCard icon="/Images/stact1.png" title="Appointments (Today)" value={158} /></Col>
                            <Col md={3}><StatCard icon="/Images/stact2.png" title="Staff on-duty" value={122} /></Col>
                            <Col md={3}><StatCard icon="/Images/stact3.png" title="Inventory Out-of-Stock" value={45} /></Col>
                            <Col md={3}><StatCard icon="/Images/stact4.png" title="Revenue (Today)" value="$7,298" /></Col>
                        </Row>
                    </div>
                </div>

                <Row>
                    <div className="TableRowDiv">
                        <TableTopBar TbleHName="Today’s Assessments" TbleHNumb="03"/>
                        <AppointmentsTable/>
                    </div>
                </Row>

                <Row>
                    <div className="TableRowDiv">
                        <TableTopBar TbleHName="Upcoming Appointments" TbleHNumb="03"/>
                        <UpComingAppointmentsTable/>
                    </div>
                </Row>

                <Row>
                    <div className="TableRowDiv">
                        <TableTopBar TbleHName="Completed Appointments" TbleHNumb="03"/>
                        <CompletedAppointmentsTable/>
                    </div>
                </Row>
                <Row>
                    <div className="DoctorClender">
                        <div className="TopClendr">
                            <div className="lftclndr">
                                <h3>My Calendar <span>(14)</span></h3>
                            </div>
                            <div className="Rytclndr">
                                <div className="clnderSlect">
                                    <Dropdown onSelect={val => setSelectedDoctor(val || "Doctor")}>
                                    <Dropdown.Toggle id="doctor-dropdown" >
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
                                    <Link href="#"><FaCalendar /> View Calendar</Link>
                                </div>

                                
                            </div>
                        </div>
                        <CalendarCard/>
                    </div>
                </Row>





















            </div>

        </Container>
    </section>
    


    </>
  )
}

export default AppointmentVet