"use client";
import React from 'react'
import "./DataTable.css"
import GenericTable from '../GenericTable/GenericTable'
import { Button, Dropdown } from 'react-bootstrap'
import {  BsThreeDotsVertical } from 'react-icons/bs';
import Image from 'next/image';
import { FaCircleCheck, FaEye, FaUser } from 'react-icons/fa6';


// Define the Column type
type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
};

// Type
type AppointmentStatus = "In-progress" | "Checked-In" | "Pending";

type TodayAppointmentItem = {
  name: string;
  owner: string;
  image: string;
  tokenNumber: string;
  reason: string;
  petType: string;
  time: string;
  date: string;
  participants: any;
  specialization: string;
  status: AppointmentStatus;
};

// Sample Data
// const appointments: TodayAppointmentItem[] = [
//   {
//     name: "Kizie",
//     owner: "Sky B",
//     image: "/Images/pet3.png",
//     appointmentId: "DRO01-03-23-2024",
//     reason: "Annual Health Check-Up",
//     breed: "Beagle/Dog",
//     time: "11:30 AM",
//     date: "01 Sep 2024",
//     doctor: "Dr. Emily Johnson",
//     specialization: "Cardiology",
//     status: "In-progress",
//   },
//   {
//     name: "Oscar",
//     owner: "Pika K",
//     image: "/Images/pet3.png",
//     appointmentId: "DRO02-03-23-2024",
//     reason: "Vaccination Updates",
//     breed: "Egyptian/Cat",
//     time: "12:15 PM",
//     date: "01 Sep 2024",
//     doctor: "Dr. David Brown",
//     specialization: "Gastroenterology",
//     status: "Checked-In",
//   },
//   {
//     name: "King",
//     owner: "Henry C",
//     image: "/Images/pet3.png",
//     appointmentId: "DRO03-03-23-2024",
//     reason: "Deworming Treatment",
//     breed: "Paso Fino/Horse",
//     time: "01:13 PM",
//     date: "01 Sep 2024",
//     doctor: "Dr. Megan Clark",
//     specialization: "Endocrinology",
//     status: "Pending",
//   },
// ];

// Columns for GenericTable
const columns: Column<TodayAppointmentItem>[] = [
    {
        label: "",
        key: "avatar",
        width: "60px",
        render: (item: TodayAppointmentItem) => (
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
    render: (item: TodayAppointmentItem) => (
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
  render: (item: TodayAppointmentItem) => <p>{item.tokenNumber}</p>,
},
{
  label: "Reason for Appointment",
  key: "reason",
  render: (item: TodayAppointmentItem) => <p>{item.reason}</p>,
},
{
  label: "Breed/Pet",
  key: "breed",
  render: (item: TodayAppointmentItem) => <p>{item.petType}</p>,
},
  {
    label: "Date",
    key: "date",
    render: (item: TodayAppointmentItem) => (
      <div>
        <p>{item.time}</p>
        <span>{item.date}</span>
      </div>
    ),
  },
  {
    label: "Doctor",
    key: "doctor",
    render: (item: TodayAppointmentItem) => (
      <div>
        <p>{item?.participants[0]?.name}</p>
        <span>{item.specialization}</span>
      </div>
    ),
  },
 {
  label: "Actions",
  key: "actions",
  render: (item: TodayAppointmentItem) => (
    <div className="action-btn-col">
      {item.status === "In-progress" ? (
        <Button className="circle-btn done"
          title="Done">
            <FaCircleCheck size={24} />
          
        </Button>
      ) : (
        <Button
          className="circle-btn view"
          title="View"
          
          onClick={() => console.log("View", item)}
        >
            <FaEye size={24}/>
        </Button>
      )}
    </div>
  ),
},
  {
  label: "",
  key: "actionsDropdown",
  render: (item: TodayAppointmentItem) => (
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

function AppointmentsTable({data}:any) {
  return (
    <>

        <div className="table-wrapper">
            <GenericTable data={data} columns={columns} bordered={false} />
            {/* <div className="table-footerBtn ">
                <Button>Sell All</Button>
            </div> */}
        </div>





    </>
  )
}

export default AppointmentsTable