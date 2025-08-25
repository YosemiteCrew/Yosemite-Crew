"use client";
import React from 'react'
import "./DataTable.css"
import GenericTable from '../GenericTable/GenericTable'
import { Button, Dropdown } from 'react-bootstrap'
import {  BsThreeDotsVertical } from 'react-icons/bs';
import Image from 'next/image';
import { FaCircleCheck, FaUser } from 'react-icons/fa6';





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
  pet: string;
  time: string;
  date: string;
  participants: any;
  specialization: string;
  status: AppointmentStatus;
};

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
  render: (item: TodayAppointmentItem) =>  <p>{item.petType}/{item.pet}</p>,
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
        <p>{item?.participants.name}</p>
        <span>{item?.specialization}</span>
      </div>
    ),
  },
 {
  label: "Actions",
  key: "actions",
  render: () => (
    <div className="action-btn-col">
        <Button className="circle-btn done"
          title="Done">
            <FaCircleCheck size={24} />
          
        </Button>
      {/* {item.status === "In-progress" ? (
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
      )} */}
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



function UpCommingAppointments(data:any) {    



  return (
    <div>
        <div className="table-wrapper">
            <GenericTable data={data.data} columns={columns} bordered={false}  pageSize={3}pagination />
            {/* <div className="table-footerBtn ">
                <Button>Sell All</Button>
            </div> */}
        </div>
    </div>
  )
}

export default UpCommingAppointments