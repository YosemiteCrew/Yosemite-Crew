"use client";
import React, { useState } from 'react'
import { LuSearch } from 'react-icons/lu'
import Dropdown from 'react-bootstrap/Dropdown';
import { Button, Form } from 'react-bootstrap';

interface TableTopBarProps {
  TbleHName: string;
  TbleHNumb: string;
}

function TableTopBar({ TbleHName ,TbleHNumb  }: TableTopBarProps) {
  const [search, setSearch] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState("Specialization");
  const [selectedStatus, setSelectedStatus] = useState("Status");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Implement search logic here
    alert(`Searching for: ${search}`);
  };

  return (
    <>
      <div className="TableTopBar">

        <div className="leftTopTbl">
          <div className="TbleText">
            <h3>{TbleHName} <span>({TbleHNumb})</span></h3>
          </div>
        </div>

        <div className="RightTopTbl" >

          <Form className="Tblserchdiv" onSubmit={handleSearch} >
            <input
              type="search"
              placeholder="Search anything"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <Button type="submit" >
              <LuSearch size={20} />
            </Button>
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
      </div>
    </>
  )
}

export default TableTopBar