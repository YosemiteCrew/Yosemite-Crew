"use client";
import React from 'react'
import "./DataTable.css"
import GenericTable from '../GenericTable/GenericTable'
import { Button, Dropdown } from 'react-bootstrap'
import { BsThreeDotsVertical } from 'react-icons/bs';
import Image from 'next/image';
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
  pet:string
};

// Columns for GenericTable
const columns: Column<AppointmentItem>[] = [
    {
        label: "",
        key: "avatar",
        width: "60px",
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
  render: (item: AppointmentItem) => <p>{item.breed}/{item.pet}</p>,
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
  key: "actions",
  render: (item: AppointmentItem) => (
    <div className="action-dropdown">
      <Dropdown align="end">
        <Dropdown.Toggle as="span" className="custom-toggle">
          <BsThreeDotsVertical className="menu-icon" />
        </Dropdown.Toggle>
        {/* <Dropdown.Menu>
          <Dropdown.Item onClick={() => console.log("Edit", item)}>Edit</Dropdown.Item>
          <Dropdown.Item onClick={() => console.log("Save", item)}>Save</Dropdown.Item>
          <Dropdown.Item onClick={() => console.log("Delete", item)}>Delete</Dropdown.Item>
        </Dropdown.Menu> */}
      </Dropdown>
    </div>
  ),
}


];

function EmergencyAppointmentsTable({ data }: { data: AppointmentItem[] }) {
  return (
    <>
        <div className="table-wrapper">
            <GenericTable data={data} columns={columns} bordered={false} />
            <div className="table-footerBtn ">
                <Button>Sell All</Button>
            </div>
        </div>
    </>
  )
}

export default EmergencyAppointmentsTable