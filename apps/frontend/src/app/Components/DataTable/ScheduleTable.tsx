"use client";
import React from "react";
import GenericTable from "../GenericTable/GenericTable";
import Image from "next/image";
import "./DataTable.css"
import { Button } from "react-bootstrap";
import { FaEye, FaUser } from "react-icons/fa6";
import { memo } from "react";

type Appointment = {
  avatar: string;
  name: string;
  participants: [{name:string}, {name:string}];
  subName: string;
  appointmentId: string;
  reason: string;
  petType: string;
  slotRef:  string;
  description: string;
  petSubType: string;
  time: string;
  date: string;
  doctor: string;
  doctorDept: string;
};

// const data: Appointment[] = [
//   {
//     avatar: "/Images/pet.jpg",
//     name: "Kizie",
//     subName: "Sky B",
//     appointmentId: "DRO01-03-23-2024",
//     reason: "Annual Health Check-Up",
//     petType: "Dog",
//     petSubType: "Beagle",
//     time: "10:15 AM",
//     date: "24 Apr 2025",
//     doctor: "Dr. Emily Johnson",
//     doctorDept: "Cardiology",
//   },
//   {
//     avatar: "/Images/pet.jpg",
//     name: "Oscar",
//     subName: "Pika K",
//     appointmentId: "DRO02-03-23-2024",
//     reason: "Vaccination Updates",
//     petType: "Cat",
//     petSubType: "Egyptian Mau",
//     time: "10:15 AM",
//     date: "24 Apr 2025",
//     doctor: "Dr. David Brown",
//     doctorDept: "Gastroenterology",
//   },
//   {
//     avatar: "/Images/pet.jpg",
//     name: "King",
//     subName: "Henry C",
//     appointmentId: "DRO03-03-23-2024",
//     reason: "Deworming Treatment",
//     petType: "Horse",
//     petSubType: "Paso Fino",
//     time: "10:30 AM",
//     date: "24 Apr 2025",
//     doctor: "Dr. Megan Clark",
//     doctorDept: "Endocrinology",
//   },
// ];

const columns = [
  {
    label: "",
    key: "avatar",
    width: "40px",
    render: (item: Appointment) => (
      <Image
        src={item.avatar}
        alt={item.name}
        width={40}
        height={40}
        className="PetImg"
      />
    ),
  },
  {
    label: "Name",
    key: "name",
    // width: "0px",
    render: (item: Appointment) => (
      <div>
        <p>{item?.participants[0]?.name}</p>
        <div className="userinfo" >
          <span><FaUser /></span>
          {item.subName}
        </div>
      </div>
    ),
  },
  {
    label: "Appointment ID",
    key: "appointmentId",
    // width: "150px",
    render: (item: Appointment) => (
      <p>{item?.slotRef}</p>
    ),
  },
  {
    label: "Reason for Appointment",
    key: "reason",
    // width: "180px",
    render: (item: Appointment) => <p>{item.reason}</p>,
  },
  {
    label: "Pet Type",
    key: "petType",
    // width: "110px",
    render: (item: Appointment) => (
      <div>
        <p>{item.petType}</p>
        {/* <span>
          {item.petSubType}
        </span> */}
      </div>
    ),
  },
  {
    label: "Time",
    key: "time",
    // width: "110px",
    render: (item: Appointment) => (
      <div>
        <p>{item.time}</p>
        <span>
          {item.date}
        </span>
      </div>
    ),
  },
  {
    label: "Doctor",
    key: "doctor",
    // width: "150px",
    render: (item: Appointment) => (
      <div>
        <p>{item?.participants[1]?.name}</p>
        <span>
          {item.doctorDept}
        </span>
      </div>
    ),
  },
  {
    label: "Actions",
    key: "actions",
    // width: "60px",
    render: () => (
      <Button className="ActionEyes" aria-label="View"><FaEye /></Button>
    ),
  },
];



function ScheduleTable({data}:any) {
  return (
    <>

    <div className="table-wrapper" >
      <GenericTable data={data} columns={columns} bordered={false} />
      <div className="table-footerBtn " style={{justifyContent:"flex-end"}}>
        <Button>Sell All</Button>
      </div>
    </div>


    </>
  )
}

export default memo(ScheduleTable)