"use client";
import React, { useState } from "react";
import "./PracticeTeam.css"
import { Button, Col, Container, Dropdown, Form, Row } from 'react-bootstrap'
import Link from 'next/link'
import { IoAddCircleOutline } from 'react-icons/io5'
import StatCard from '@/app/Components/StatCard/StatCard'
import { HeadingDiv } from '../BusinessDashboard/BusinessDashboard'
import RoundCommonTabs from '@/app/Components/RoundCommonTabs/RoundCommonTabs'
import CardiologyTable from '@/app/Components/DataTable/CardiologyTable'
import ManageInviteTable from "@/app/Components/DataTable/ManageInviteTable";
import { LuSearch } from "react-icons/lu";

function PracticeTeam() {

    const [search, setSearch] = useState("");
    const [selectedDoctor, setSelectedDoctor] = useState("Doctor");
    const [selectedStatus, setSelectedStatus] = useState("Status");
    const [ManageInvites, setManageInvites] = useState(false);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        // Implement search logic here
        alert(`Searching for: ${search}`);
    };

    const CardiologyTabs = [
    {
      eventKey: 'veterinary',
      title: 'Veterinary',
      content: (
        <>
          <CardiologyTable/>
        </>
      ),
    },
    {
      eventKey: 'nurse',
      title: 'Nurse',
      content: (
        <>
          <CardiologyTable/>
        </>
      ),
    },
    {
      eventKey: 'internist',
      title: 'Internist',
      content: (
        <>
          <CardiologyTable/>
        </>
      ),
    },
    {
      eventKey: 'radiologist',
      title: 'Radiologist',
      content: (
        <>
          <CardiologyTable/>
        </>
      ),
    },
    {
      eventKey: 'assistant',
      title: 'Assistant',
      content: (
        <>
          <CardiologyTable/>
        </>
      ),
    },
    
    
  ];



  return (
    <>
    <section className='PracticeTeamSec'>
        <Container>
            {!ManageInvites ? (

            <div className="PracticeTeamData">
                <div className="PracticeTopHead">
                    <div className="leftPract">
                        <h2><span>Practice </span> Team</h2>
                    </div>
                    <div className="RytPract">
                        <Link href="#" onClick={() => setManageInvites(true)}>Manage Invites</Link>
                        <Link href="#" className='fill'><IoAddCircleOutline size={20} /> Invite Practice Member</Link>
                    </div>
                </div>
                <div className="Teamoverview">
                    <h5>Overview</h5>
                    <Row>
                        <Col md={3}><StatCard icon="/Images/stact1.png" title="Appointments (Today)" value={158} /></Col>
                        <Col md={3}><StatCard icon="/Images/stact2.png" title="Staff on-duty" value={122} /></Col>
                        <Col md={3}><StatCard icon="/Images/stact3.png" title="Inventory Out-of-Stock" value={45} /></Col>
                        <Col md={3}><StatCard icon="/Images/stact4.png" title="Revenue (Today)" value="$7,298" /></Col>
                    </Row>
                </div>
                <Row>
                    <div className="TableItemsRow">
                        <HeadingDiv Headname="Cardiology" Headspan="15" />
                        <RoundCommonTabs tabs={CardiologyTabs} showSearch />
                    </div>
                </Row>
                <Row>
                    <div className="TableItemsRow">
                        <HeadingDiv Headname="Dermatology" Headspan="12" />
                        <RoundCommonTabs tabs={CardiologyTabs} showSearch />
                    </div>
                </Row>
                <Row>
                    <div className="TableItemsRow">
                        <HeadingDiv Headname="Emergency and Critical Care" Headspan="18" />
                        <RoundCommonTabs tabs={CardiologyTabs} showSearch />
                    </div>
                </Row>
            </div>

            ) : ( 

            <div className="ManageInvitesDiv">

                <div className="TopManagInvite">
                    <h2>Manage <span>Invites</span></h2>
                    <Link href="#">Manage Practice Teams</Link>
                </div>

                <div className="MangeInviteTableDiv">
                    <div className="RightTopTbl">

                        <Form className="Tblserchdiv" onSubmit={handleSearch} >
                            <input
                            type="search"
                            placeholder="Search Patient name, time, Vet name"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            />
                            <Button type="submit"><LuSearch size={20} /></Button>
                        </Form>


                        <div className="DoctSlect">
                            <Dropdown onSelect={val => setSelectedDoctor(val || "Doctor")}>
                            <Dropdown.Toggle id="doctor-dropdown" >
                                {selectedDoctor}
                            </Dropdown.Toggle>
                            <Dropdown.Menu>
                                <Dropdown.Item eventKey="Doctor">Doctor</Dropdown.Item>
                                <Dropdown.Item eventKey="Dr. Smith">Dr. Smith</Dropdown.Item>
                                <Dropdown.Item eventKey="Dr. Jane">Dr. Jane</Dropdown.Item>
                                <Dropdown.Item eventKey="Dr. Lee">Dr. Lee</Dropdown.Item>
                            </Dropdown.Menu>
                            </Dropdown>
                        </div>


                        <div className="StatusSlect">
                            <Dropdown onSelect={val => setSelectedStatus(val || "Status")}>
                            <Dropdown.Toggle id="status-dropdown" style={{ borderRadius: '25px', border: '1px solid #D9D9D9', background: '#fff', color: '#222', minWidth: '100px', fontWeight: 400 }}>
                                {selectedStatus}
                            </Dropdown.Toggle>
                            <Dropdown.Menu>
                                <Dropdown.Item eventKey="Status">Status</Dropdown.Item>
                                <Dropdown.Item eventKey="Pending">Pending</Dropdown.Item>
                                <Dropdown.Item eventKey="Completed">Completed</Dropdown.Item>
                                <Dropdown.Item eventKey="Cancelled">Cancelled</Dropdown.Item>
                            </Dropdown.Menu>
                            </Dropdown>
                        </div>

                    </div>
                    <ManageInviteTable/>

                </div>






            </div>


            )}

        </Container>
    </section>
    </>
  )
}

export default PracticeTeam