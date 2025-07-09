'use client';
import React, { useState , useEffect } from 'react';
import "./InventoryDashboard.css"
import { Col, Container, Row } from 'react-bootstrap'
import { HeadText } from '../CompleteProfile/CompleteProfile'
import StatCard from '@/app/Components/StatCard/StatCard'
import { OverviewDisp } from '../Departments/DepartmentsDashboard'
import { GraphSelected } from '../AdminDashboardEmpty/AdminDashboardEmpty';
import DepartmentBarChart from '@/app/Components/BarGraph/DepartmentBarChart';
import ApprochExpireGraph from '@/app/Components/BarGraph/ApprochExpireGraph';
import { DepartmentData } from '@/app/types';
import CommonTabs from '@/app/Components/CommonTabs/CommonTabs';
import ManageInventoryTable from '@/app/Components/DataTable/ManageInventoryTable';
import ProcedurePackagesTable from '@/app/Components/DataTable/ProcedurePackagesTable';

function InventoryDashboard() {

    const [selectedDoctor, setSelectedDoctor] = useState("Last 30 Days");
    const [selectedRange, setSelectedRange] = useState("Last 3 Months");// graphSelected 

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

    const approachingExpiryData = [
        { name: '<7 Days', value: 145 },
        { name: '<15 Days', value: 180 },
        { name: '<30 Days', value: 90 },
        { name: '<60 Days', value: 60 },
    ];


    const manageinvtTabs = [
        {
        eventKey: 'Appointments',
        title: 'Appointments',
        content: (
            <>
                <ManageInventoryTable/>
            </>
        ),
        },
        {
        eventKey: 'Assessments',
        title: 'Assessments',
        content: (
            <>
                <ManageInventoryTable/>
            </>
        ),
        }
    ];

  return (
    <>

    <section className='InventoryDashboardSec'>
        <Container>
            <div className="InventoryDashboardData">
                <div className="inventoryTopBar">
                    <HeadText blktext="Inventory" Spntext="Overview" />
                    <div className="inventryoverview">
                        <OverviewDisp hideTitle={true} showDropdown={true} selectedDoctor={selectedDoctor} setSelectedDoctor={setSelectedDoctor}/>
                        <Row>
                            <Col md={3}><StatCard icon="/Images/stact1.png" title="Appointments (Today)" value={158} /></Col>
                            <Col md={3}><StatCard icon="/Images/stact2.png" title="Staff on-duty" value={122} /></Col>
                            <Col md={3}><StatCard icon="/Images/stact3.png" title="Inventory Out-of-Stock" value={45} /></Col>
                            <Col md={3}><StatCard icon="/Images/stact4.png" title="Revenue (Today)" value="$7,298" /></Col>
                        </Row>
                    </div>
                    <Row>
                        <Col md={6}>
                            <div className="graphinvetry">
                                <OverviewDisp hideTitle={false} titleText="Approaching Expiry" showDropdown={false} />
                                <ApprochExpireGraph chartData={approachingExpiryData} />
                            </div>
                        </Col>

                        <Col md={6}>

                            <GraphSelected
                                title="Category Breakdown"
                                options={["Last 3 Months", "Last 6 Months", "Last 1 Year"]}
                                selectedOption={selectedRange}
                                onSelect={setSelectedRange}/>
                                <DepartmentBarChart data={data.length > 0 ? data : departmentStats} />

                        </Col>
                    </Row>
                </div>
                <div className="MangeInventryData">
                    <HeadText blktext="Manage" Spntext="Inventory" />
                    <CommonTabs tabs={manageinvtTabs} />
                    <div className="ProcedurePackage">
                        <h4>Procedure Packages</h4>
                        <ProcedurePackagesTable/>
                    </div>
                </div>
            </div>
        </Container>
    </section>
    </>
  )
}

export default InventoryDashboard