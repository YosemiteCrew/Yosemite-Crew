"use client";
import React, { useState,useEffect } from "react";
import "./BusinessDashboard.css"
import {  Col, Container, Row } from 'react-bootstrap'
import StatCard from '@/app/Components/StatCard/StatCard'
import { GraphSelected } from '../AdminDashboardEmpty/AdminDashboardEmpty'
import DepartmentBarChart from "@/app/Components/BarGraph/DepartmentBarChart";
import { DepartmentData } from "@/app/types";
import { IoIosAddCircleOutline, IoMdEye } from "react-icons/io";
import Link from "next/link";
import { IoNotifications } from "react-icons/io5";
import AppointmentGraph from "@/app/Components/BarGraph/AppointmentGraph";
import CommonTabs from "@/app/Components/CommonTabs/CommonTabs";

import ScheduleTable from "@/app/Components/DataTable/ScheduleTable";
import ChartCard from "@/app/Components/BarGraph/ChartCard";
import PracticeTeamTable from "@/app/Components/DataTable/PracticeTeamTable";
import InventoryTable from "@/app/Components/DataTable/InventoryTable";



function BusinessDashboard() {

  const [selectedRange, setSelectedRange] = useState("Last 30 Days");// graphSelected 

  // departmentStats Started 

  const [data, setData] = useState<DepartmentData[]>([]);
  useEffect(() => {
    fetch('/api/departments')
      .then(res => res.json())
      .then(json => setData(json));
  }, []);

  const departmentStats = [
    { name: 'Oncology', value: 250 },
    { name: 'Cardiology', value: 167 },
    { name: 'Internal Medicine', value: 118 },
    { name: 'Gastroenterology', value: 74 },
    { name: 'Orthopaedics', value: 348 },
  ];
  // departmentStats Ended


  const scheduleTabs = [
    {
      eventKey: 'Appointments',
      title: 'Appointments',
      content: (
        <>
          <ScheduleTable
          />
        </>
      ),
    },
    {
      eventKey: 'Assessments',
      title: 'Assessments',
      content: (
        <>
          <ScheduleTable
          />
        </>
      ),
    }
  ];

  const practiceTabs = [
    {
      eventKey: 'Cardiology',
      title: 'Cardiology',
      content: (
        <>
          <PracticeTeamTable/>
        </>
      ),
    },
    {
      eventKey: 'Dermatology',
      title: 'Dermatology',
      content: (
        <>
          <PracticeTeamTable/>
        </>
      ),
    },
    {
      eventKey: 'Emergency and Critical Care',
      title: 'Emergency and Critical Care',
      content: (
        <>
          <PracticeTeamTable/>
        </>
      ),
    },
    {
      eventKey: 'Dentistry',
      title: 'Dentistry',
      content: (
        <>
          <PracticeTeamTable/>
        </>
      ),
    },
    {
      eventKey: 'Marketing',
      title: 'Marketing',
      content: (
        <>
          <PracticeTeamTable/>
        </>
      ),
    },
    
  ];


  const inventoryTabs = [
    {
      eventKey: 'Pharmaceuticals',
      title: 'Pharmaceuticals',
      content: (
        <>
          <InventoryTable/>
        </>
      ),
    },
    {
      eventKey: 'Medical Supplies',
      title: 'Medical Supplies',
      content: (
        <>
          <InventoryTable/>
        </>
      ),
    },
    {
      eventKey: 'Pet Care Products',
      title: 'Pet Care Products',
      content: (
        <>
          <InventoryTable/>
        </>
      ),
    },
    {
      eventKey: 'Diagnostics',
      title: 'Diagnostics',
      content: (
        <>
          <InventoryTable/>
        </>
      ),
    },
    {
      eventKey: 'Equipments',
      title: 'Equipments',
      content: (
        <>
          <InventoryTable/>
        </>
      ),
    },
    {
      eventKey: 'Office Supplies',
      title: 'Office Supplies',
      content: (
        <>
          <InventoryTable/>
        </>
      ),
    },
    
    
  ];



  return (
    <>
    <section className='BusinessDashboardSec'>
        <Container>

          <div className="BusinessDashboardData">

            <div className="BuisnessDashTop">
              <div className="TopDashHead">
                <div className="leftwlmdiv">
                  <span>Welcome</span>
                  <div className="wlcdash">
                    <h2>Your Dashboard</h2>
                    <div className="Apoitpopup">
                      <IoNotifications /> 8 New Appointments
                    </div>
                  </div>
                </div>
                <div className="Ryttwlmdiv">
                  <div className="ClinicVisibleBtn">
                    <Link href="" ><IoMdEye /> Manage Clinic Visibility</Link>
                  </div>
                  <div className="invitbtn">
                    <Link href="/practiceTeam" ><IoIosAddCircleOutline /> Invite Practice Member</Link>
                  </div>
                </div>
              </div>
              <Row>
                <Col md={3}><StatCard icon="/Images/stact1.png" title="Appointments (Today)" value={158} /></Col>
                <Col md={3}><StatCard icon="/Images/stact2.png" title="Staff on-duty" value={122} /></Col>
                <Col md={3}><StatCard icon="/Images/stact3.png" title="Inventory Out-of-Stock" value={45} /></Col>
                <Col md={3}><StatCard icon="/Images/stact4.png" title="Revenue (Today)" value="$7,298" /></Col>
              </Row>
            </div>

            <Row>
              <Col md={6}>
                <GraphSelected
                  title="Revenue"
                  options={["Last 3 Months", "Last 6 Months", "Last 1 Year"]}
                  selectedOption={selectedRange}
                  onSelect={setSelectedRange}/>

                <AppointmentGraph/>

              </Col>
              <Col md={6}>
                <GraphSelected
                  title="Department-wise Income"
                  options={["Last 30 Days", "Last 6 Months", "Last 1 Year"]}
                  selectedOption={selectedRange}
                  onSelect={setSelectedRange}/>

                  <ChartCard/>
                
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <GraphSelected
                  title="Speciality-wise appointments"
                  options={["Last 3 Months", "Last 6 Months", "Last 1 Year"]}
                  selectedOption={selectedRange}
                  onSelect={setSelectedRange}/>
                <DepartmentBarChart data={data.length > 0 ? data : departmentStats} />

              </Col>
              <Col md={6}>
                <GraphSelected
                  title="Department-wise Income"
                  options={["Last 30 Days", "Last 6 Months", "Last 1 Year"]}
                  selectedOption={selectedRange}
                  onSelect={setSelectedRange}/>
                <div className="DepartIncomDiv">
                    <div className="DeprtInner">
                      <div className="onclogydiv">
                        <div className="departText">
                          <p>Oncology</p>
                          <h5>$9,700</h5>
                        </div>
                      </div>

                      <div className="intrmedcndiv">
                        <div className="departText">
                          <p>Internal Medicine</p>
                          <h5>$7,500</h5>
                        </div>
                      </div>

                      <div className="Orthopedicsdiv">
                        <div className="departText">
                          <p>Orthopedics</p>
                          <h5>$6,200</h5>
                        </div>
                      </div>

                      <div className="Gastroenterologydiv">
                        <div className="departText">
                          <p>Gastroenterology</p>
                          <h5>$6,500</h5>
                        </div>
                      </div>

                      <div className="Cardiologydiv">
                        <div className="departText">
                          <p>Cardiology</p>
                          <h5>$9,700</h5>
                        </div>
                      </div>

                      <div className="Neurologydiv">
                        <div className="departText">
                          <p>Neurology</p>
                          <h5>$6,230</h5>
                        </div>
                      </div>
                    </div>
                </div>
              </Col>
            </Row>

            <Row>
              <div className="TableItemsRow">
                <HeadingDiv Headname="Today’s Schedule" Headspan="95" />
                <CommonTabs tabs={scheduleTabs} showStatusSelect/>
              </div>
            </Row>

            <Row>
              <div className="TableItemsRow">
                <HeadingDiv Headname="Practice Team" Headspan="74" />
                <CommonTabs tabs={practiceTabs} showStatusSelect/>
              </div>
            </Row>

            <Row>
              <div className="TableItemsRow">
                <HeadingDiv Headname="Inventory" />
                <CommonTabs tabs={inventoryTabs} showStatusSelect/>
              </div>
            </Row>

          </div>

        </Container>
    </section>


    </>
  )
}

export default BusinessDashboard




// HeadingDivProps Started 
interface HeadingDivProps {
  Headname: string;
  Headspan?: string | number; // <-- Now it's optional
}

export function HeadingDiv({ Headname, Headspan }: HeadingDivProps) {
  return (
    <div className="DivHeading">
      <h5>
        {Headname}
        {Headspan !== undefined && <span>({Headspan})</span>}
      </h5>
    </div>
  );
}
// HeadingDivProps Ended
