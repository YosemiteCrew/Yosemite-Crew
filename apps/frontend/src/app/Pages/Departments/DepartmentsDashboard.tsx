'use client';
import React, { useState } from 'react';
import "./Departments.css"
import Header from '@/app/Components/Header/Header';
import { Col, Container, Row } from 'react-bootstrap';
import StatCard from '@/app/Components/StatCard/StatCard';
import { MBTN } from '../BlogPage/BlogPage';
import { IoAddCircleOutline } from 'react-icons/io5';

function DepartmentsDashboard() {
    const [isLoggedIn] = useState(true);
  return (
    <>
        <Header isLoggedIn={isLoggedIn} />
        
        <section className='DeapartmentDashSection'>
            <Container>

                <div className="SpecilistTopDiv">

                    <div className="a">
                        <h2>Specialities</h2>
                        <MBTN BICON={<IoAddCircleOutline />} BNAME="Add Specialities" BtHerf="#" />
                    </div>

                    <div className="s">
                        <div className="s"></div>
                        <Row>
                            <Col md={3}><StatCard icon="/Images/stact1.png" title="Appointments (Today)" value={158} /></Col>
                            <Col md={3}><StatCard icon="/Images/stact2.png" title="Staff on-duty" value={122} /></Col>
                            <Col md={3}><StatCard icon="/Images/stact3.png" title="Inventory Out-of-Stock" value={45} /></Col>
                            <Col md={3}><StatCard icon="/Images/stact4.png" title="Revenue (Today)" value="$7,298" /></Col>
                        </Row>
                    </div>
                </div>






            </Container>
        </section>














    </>
  )
}

export default DepartmentsDashboard