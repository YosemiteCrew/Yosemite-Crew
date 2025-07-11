"use client";
import React, { useState,useMemo } from "react";
import "./ProcedureEstimate.css"
import { Button, Col, Container, Dropdown, Form, Row } from 'react-bootstrap'
import Link from 'next/link'
import { IoAddCircle } from 'react-icons/io5'
import ProcedureEstimatesTable from '@/app/Components/DataTable/ProcedureEstimatesTable'
import { LuSearch } from 'react-icons/lu'
import { HeadText } from "../CompleteProfile/CompleteProfile";
import { FormInput } from "../Sign/SignUp";
import DynamicSelect from "@/app/Components/DynamicSelect/DynamicSelect";
import AddItemsTable from "@/app/Components/DataTable/AddItemsTable";

import { countries } from "country-list-json";
import { FaCircleCheck } from "react-icons/fa6";
import { ComnBtn } from "../ClinicVisiblity/ClinicVisiblity";
import { FaShareAlt } from "react-icons/fa";

function ProcedureEstimate() {
  const [ManageProcedure, setManageProcedure] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("Status");
  const [search, setSearch] = useState("");
  const [pname, setPname] = useState("") 
  const handleSearch = (e: React.FormEvent) => {
          e.preventDefault();
          // Implement search logic here
          alert(`Searching for: ${search}`);
      };

   
  
  const [country, setCountry] = useState<string>('');
  type Option = {
    value: string;
    label: string;
  };
  const Option1: Option[] = useMemo(() =>
      countries.map((v) => ({
        value: v.code,
        label: `${v.flag} ${v.name}`,
      })), []
    );


  return (
    <>

    <section className='ProcedureEstimateSec'>
        <Container>

          {!ManageProcedure ? (

            <div className="ProcedureEstimateData">
                <div className="ProcedureTopHead">
                    <h2>Manage Procedure Estimates</h2>
                    <FillBTN path="#" icon={<IoAddCircle size={20}/>} text="Add New Estimate" onClick={() => setManageProcedure(true)}/>
                </div>
                <div className="ProcedureTableDiv">
                  <div className="RightTopTbl">
                    <Form className="Tblserchdiv" onSubmit={handleSearch} >
                        <input
                        type="search"
                        placeholder="Estimate Name"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        />
                        <Button type="submit"><LuSearch size={20} /></Button>
                    </Form>
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
                  <ProcedureEstimatesTable/>
                </div>
            </div>

          ) : ( 

            <div className="AddProcedureEstmDiv">

              <HeadText blktext="Add" Spntext="New Procedure Estimate" />

              <div className="AddProcedureBox">
                <Form>

                  <Row>
                    <Col md={6}>
                      <FormInput readonly={false}  intype="name" inname="name" value={pname} inlabel="Procedure Name" onChange={(e) => setPname(e.target.value)}/>
                    </Col>
                    <Col md={6}>
                      <DynamicSelect options={Option1} value={country} onChange={setCountry} inname="Department" placeholder="Department"/>
                    </Col>
                  </Row>

                  <Row>
                    <Col md={6}>
                    <DynamicSelect options={Option1} value={country} onChange={setCountry} inname="Department" placeholder="Department"/>
                    </Col>
                    <Col md={6}>
                      <FormInput readonly={false}  intype="text" inname="name" value={pname} inlabel="Add a description" onChange={(e) => setPname(e.target.value)}/>
                    </Col>
                  </Row>

                </Form>
                <div className="Lines"></div>
                <div className="ProcedureAddItemDiv">
                  <h5>Add Items</h5>
                  <AddItemsTable />
                </div>
                <div className="Lines"></div>
                <div className="ProcedureSummery">
                  <h6>Procedure Estimate Summary</h6>
                  <div className="SummeryBox">

                    <div className="SummryItems">
                      <h5>Sub Total</h5>
                      <h5>$4495.00</h5>
                    </div>
                    <div className="SummryItems">
                      <h5>Discount</h5>
                      <h5>$85.00</h5>
                    </div>
                    <div className="SummryItems">
                      <h5>Tax</h5>
                      <h5>$385.00</h5>
                    </div>
                    <div className="SummryItemsTotal">
                      <h4>Total</h4>
                      <h4>$385.00</h4>
                    </div>
                    
                  </div>
                </div>
              </div>

              <div className="PrecedorBottomBtn">
                <ComnBtn CompText="Share Estimate" CompIcon={<FaShareAlt />} />
                <FillBTN path="#" icon={<FaCircleCheck size={20}/>} text="Add Procedure" />
              </div>

            </div>

          )}
        </Container>
    </section>





    </>
  )
}

export default ProcedureEstimate

interface FillBTNProps {
  path: string; 
  icon: React.ReactNode; 
  text: string; 
  onClick?: React.MouseEventHandler<HTMLAnchorElement>; 
}
function FillBTN({path , icon , text , onClick }:FillBTNProps) {
    return <Link href={path} className='FillBtn' onClick={onClick}>{icon} {text}</Link>
}
