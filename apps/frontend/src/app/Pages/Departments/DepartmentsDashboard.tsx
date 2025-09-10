'use client';
import React, { useState ,useEffect } from 'react';
import "./Departments.css"
import { Col, Container, Dropdown, Row } from 'react-bootstrap';
import StatCard from '@/app/Components/StatCard/StatCard';
import { MBTN } from '../BlogPage/BlogPage';
import { DepartmentData } from "@/app/types";
import { IoAddCircleOutline } from 'react-icons/io5';
import { GraphSelected } from '../AdminDashboardEmpty/AdminDashboardEmpty';
import DepartmentBarChart from '@/app/Components/BarGraph/DepartmentBarChart';
import SpecialitesAppoint from '@/app/Components/BarGraph/SpecialitesAppoint';


function DepartmentsDashboard() {
    const [selectedDoctor, setSelectedDoctor] = useState("Last 7 Days");
    const [selectedRange, setSelectedRange] = useState("Last 6 Months");// graphSelected 

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

      const yourFetchedData = [
        { day: 'M', appointments: 60 },
        { day: 'T', appointments: 85 },
        { day: 'W', appointments: 100 },
        { day: 'T', appointments: 50 },
        { day: 'F', appointments: 90 },
        { day: 'S', appointments: 70 },
        { day: 'M', appointments: 60 },
        ];
    
  return (
    <> 
        <section className='DeapartmentDashSection'>
            <Container>
                <div className="SpecilistData">

                    <div className="SpecilistTopDiv">
                        <div className="SpeciltHead">
                            <h2>Specialities</h2>
                            <MBTN BICON={<IoAddCircleOutline />} BNAME="Add Specialities" BtHerf="adddepartments" />
                        </div>
                        <div className="SpeclistOverviewDiv">
                          <OverviewDisp hideTitle={false} showDropdown={true} selectedDoctor={selectedDoctor} setSelectedDoctor={setSelectedDoctor}/>
                            <Row>
                                <Col md={3}><StatCard icon="https://d2il6osz49gpup.cloudfront.net/Images/stact1.png" title="Appointments (Today)" value={158} /></Col>
                                <Col md={3}><StatCard icon="https://d2il6osz49gpup.cloudfront.net/Images/stact2.png" title="Staff on-duty" value={122} /></Col>
                                <Col md={3}><StatCard icon="https://d2il6osz49gpup.cloudfront.net/Images/stact3.png" title="Inventory Out-of-Stock" value={45} /></Col>
                                <Col md={3}><StatCard icon="https://d2il6osz49gpup.cloudfront.net/Images/stact4.png" title="Revenue (Today)" value="$7,298" /></Col>
                            </Row>
                        </div>
                    </div>

                    <div className="GraphGridDiv">
                        <div className="d">
                            <GraphSelected
                            title="Department-wise appointments"
                            options={["Last 3 Months", "Last 6 Months", "Last 1 Year"]}
                            selectedOption={selectedRange}
                            onSelect={setSelectedRange}/>
                            <DepartmentBarChart data={data.length > 0 ? data : departmentStats} />
                        </div>
                        <div className="d">
                            <div className="ss"></div>
                            <SpecialitesAppoint appointmentsData={yourFetchedData} />
                        </div>
                    </div>

                    <div className="ss">
                        <h5>Cardiology</h5>
                        <div className="s">
                            <div className="d">
                                
                            </div>
                            <div className="s">
                                <SpecialitesAppoint appointmentsData={yourFetchedData} />
                            </div>
                            <div className="ss">
                                <StatCard icon="https://d2il6osz49gpup.cloudfront.net/Images/stact1.png" title="Appointments (Today)" value={158} />
                                <StatCard icon="https://d2il6osz49gpup.cloudfront.net/Images/stact2.png" title="Staff on-duty" value={122} />
                            </div>
                        </div>



                    </div>

                    








                </div>
            </Container>
        </section>














    </>
  )
}

export default DepartmentsDashboard


// OverviewDispProps Started 

interface OverviewDispProps {
  setSelectedDoctor?: React.Dispatch<React.SetStateAction<string>>;
  selectedDoctor?: string;
  showDropdown?: boolean;
  showText?: boolean;
  titleText?: string;   // Text for the left side
  hideTitle?: boolean;  // ✅ NEW: hide the title text but keep space
  text?: string;        // Right side text
}

export function OverviewDisp({
  setSelectedDoctor,
  selectedDoctor,
  showDropdown = false,
  showText = false,
  titleText = "Overview",
  hideTitle = false,    // ✅ NEW
  text = ""
}: OverviewDispProps) {
  return (
    <div className="OverViewDiv">
      {hideTitle ? (
        <h5 style={{ visibility: "hidden" }}></h5>
      ) : (
        <h5>{titleText}</h5>
      )}

      <div className="clnderSlect">
        {showDropdown && setSelectedDoctor && selectedDoctor && (
          <Dropdown onSelect={val => setSelectedDoctor(val || "Doctor")}>
            <Dropdown.Toggle id="doctor-dropdown" className="custom-status-dropdown">
              {selectedDoctor}
            </Dropdown.Toggle>
            <Dropdown.Menu>
              <Dropdown.Item eventKey="Last 7 Days">Last 7 Days</Dropdown.Item>
              <Dropdown.Item eventKey="Last 15 Days">Last 15 Days</Dropdown.Item>
              <Dropdown.Item eventKey="Last 30 Days">Last 30 Days</Dropdown.Item>
              <Dropdown.Item eventKey="Last 45 Days">Last 45 Days</Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        )}

        {showText && <span>{text}</span>}

        {!showDropdown && !showText && (
          <span>&nbsp;</span>
        )}
      </div>
    </div>
  );
}