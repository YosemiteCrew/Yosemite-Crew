"use client";
import React, { useState } from 'react'
import "./DataTable.css";
import { Button, Dropdown, Form } from 'react-bootstrap';
import GenericTable from '../GenericTable/GenericTable';
import { LuSearch } from 'react-icons/lu';
import Image from 'next/image';
import { BsThreeDotsVertical } from 'react-icons/bs';
import { FaUser } from 'react-icons/fa6';


// Define the Column type
type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
};

// Type
type AppointmentStatus = "In-progress" | "Checked-In" | "Pending";

type AppointmentItem = {
  name: string;
  owner: string;
  image: string;
  appointmentId: string;
  reason: string;
  breed: string;
  time: string;
  date: string;
  doctor: string;
  specialization: string;
  status: AppointmentStatus;
};

// Sample Data
const appointments: AppointmentItem[] = [
  {
    name: "Kizie",
    owner: "Sky B",
    image: "/Images/pet.jpg",
    appointmentId: "DRO01-03-23-2024",
    reason: "Annual Health Check-Up",
    breed: "Beagle/Dog",
    time: "11:30 AM",
    date: "01 Sep 2024",
    doctor: "Dr. Emily Johnson",
    specialization: "Cardiology",
    status: "In-progress",
  },
  {
    name: "Oscar",
    owner: "Pika K",
    image: "/Images/pet.jpg",
    appointmentId: "DRO02-03-23-2024",
    reason: "Vaccination Updates",
    breed: "Egyptian/Cat",
    time: "12:15 PM",
    date: "01 Sep 2024",
    doctor: "Dr. David Brown",
    specialization: "Gastroenterology",
    status: "Checked-In",
  },
  {
    name: "King",
    owner: "Henry C",
    image: "/Images/pet.jpg",
    appointmentId: "DRO03-03-23-2024",
    reason: "Deworming Treatment",
    breed: "Paso Fino/Horse",
    time: "01:13 PM",
    date: "01 Sep 2024",
    doctor: "Dr. Megan Clark",
    specialization: "Endocrinology",
    status: "Pending",
  },
];

// Columns for GenericTable
const columns: Column<AppointmentItem>[] = [
    {
        label: "",
        key: "avatar",
        width: "40px",
        render: (item: AppointmentItem) => (
          <Image
            src={item.image}
            alt={item.name}
            width={40}
            height={40}
            style={{ borderRadius: "50%" }}
          />
        ),
      },
  {
    label: "Name",
    key: "name",
    render: (item: AppointmentItem) => (
      <div className="user-info">
        
        <div>
          <p className="name">{item.name}</p>
          <span className="owner"><FaUser /> {item.owner}</span>
        </div>
      </div>
    ),
  },
  {
  label: "Appointment ID",
  key: "appointmentId",
  render: (item: AppointmentItem) => <p>{item.appointmentId}</p>,
},
{
  label: "Reason for Appointment",
  key: "reason",
  render: (item: AppointmentItem) => <p>{item.reason}</p>,
},
{
  label: "Breed/Pet",
  key: "breed",
  render: (item: AppointmentItem) => <p>{item.breed}</p>,
},
  {
    label: "Date",
    key: "date",
    render: (item: AppointmentItem) => (
      <div>
        <p>{item.time}</p>
        <span>{item.date}</span>
      </div>
    ),
  },
  {
    label: "Doctor",
    key: "doctor",
    render: (item: AppointmentItem) => (
      <div>
        <p>{item.doctor}</p>
        <span>{item.specialization}</span>
      </div>
    ),
  },
  {
    label: "Patient Status",
    key: "status",
    render: (item: AppointmentItem) => (
      <div className="status-col">
        <span
          className={`status-badge ${item.status.replace(/\s/g, '-').toLowerCase()}`}
        >
          <span>●</span> {item.status}
        </span>
        
      </div>
    ),
  },
  {
  label: "",
  key: "actionsDropdown",
  render: (item: AppointmentItem) => (
    <div className="action-dropdown">
      <Dropdown align="end">
        <Dropdown.Toggle as="span" className="custom-toggle">
          <BsThreeDotsVertical className="menu-icon" />
        </Dropdown.Toggle>
        <Dropdown.Menu>
          <Dropdown.Item onClick={() => console.log("Edit", item)}>Edit</Dropdown.Item>
          <Dropdown.Item onClick={() => console.log("Save", item)}>Save</Dropdown.Item>
          <Dropdown.Item onClick={() => console.log("Delete", item)}>Delete</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
    </div>
  ),
}


];

function AllAppointmentsTable() {

    const [selectedStatus, setSelectedStatus] = useState("Doctor");
    const [selectedPaymentStatus, setSelectedPaymentStatus] = useState("Status");
    const [search, setSearch] = useState("");
    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        // Implement search logic here
        alert(`Searching for: ${search}`);
    };
    


  return (
    <>

     <div className="TableDropdownWrapper">

        <div className="TableTopTexed">
            <div className="LeftTopTbl">
                <h3>All Appointments (<span>03</span>)</h3>
            </div>
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
                <div className="StatusSlect">
                    <Dropdown onSelect={val => setSelectedStatus(val || "Doctor")}>
                    <Dropdown.Toggle id="status-dropdown" >
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
                <div className="StatusSlect">
                    <Dropdown onSelect={val => setSelectedPaymentStatus(val || "Status")}>
                    <Dropdown.Toggle id="status-dropdown" >
                        {selectedPaymentStatus}
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

        <div className="table-wrapper">
            <GenericTable data={appointments} columns={columns} bordered={false} pagination pageSize={6} />
        </div>
    </div>
      
    </>
  )
}

export default AllAppointmentsTable
