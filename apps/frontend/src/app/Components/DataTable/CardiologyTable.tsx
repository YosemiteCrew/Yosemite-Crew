"use client";
import React from "react";
import GenericTable from "../GenericTable/GenericTable";
import Image from "next/image";
import { Button } from "react-bootstrap";
import { FaEye } from "react-icons/fa6";


type CardiolgyItems = {
  avatar: string;
  name: string;
  subName: string;
  email: string;
  number: string;
  week: string;
  time: string;
  status: string;
};

const Cardiolgy: CardiolgyItems[] = [

  {
    avatar: "/Images/pet1.png",
    name: "Dr. Laura Evans",
    subName: "Senior Veterinary",
    email: "dvm.lauraevans@yc.com",
    number: "(704) 555-0127",
    week: "Mon-Fri",
    time: "9AM–5PM",
    status: " ",
  },
  {
    avatar: "/Images/pet1.png",
    name: "Dr. Laura Evans",
    subName: "Senior Veterinary",
    email: "dvm.lauraevans@yc.com",
    number: "(704) 555-0127",
    week: "Mon-Fri",
    time: "9AM–5PM",
    status: "off-duty",
  },
  {
    avatar: "/Images/pet1.png",
    name: "Dr. Laura Evans",
    subName: "Senior Veterinary",
    email: "dvm.lauraevans@yc.com",
    number: "(704) 555-0127",
    week: "Mon-Fri",
    time: "9AM–5PM",
    status: "Consulting",
  },
  {
    avatar: "/Images/pet1.png",
    name: "Dr. Laura Evans",
    subName: "Senior Veterinary",
    email: "dvm.lauraevans@yc.com",
    number: "(704) 555-0127",
    week: "Mon-Fri",
    time: "9AM–5PM",
    status: "break",
  },
 



];

const columns = [

  {
    label: "",
    key: "avatar",
    width: "60px",
    render: (item: CardiolgyItems) => (
      <Image
        src={item.avatar}
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
    // width: "0px",
    render: (item: CardiolgyItems) => (
      <div>
        <p>{item.name}</p>
        <span> {item.subName}</span>
      </div>
    ),
  },
  {
    label: "Email Address",
    key: "email",
    // width: "150px",
    render: (item: CardiolgyItems) => (
      <p>{item.email}</p>
    ),
  },
  {
    label: "Phone Number",
    key: "phone",
    // width: "180px",
    render: (item: CardiolgyItems) => <p>{item.number}</p>,
  },
 
  {
    label: "Schedule",
    key: "schedule",
    // width: "150px",
    render: (item: CardiolgyItems) => (
      <div>
        <p>{item.week}</p>
        <span>{item.time}</span>
      </div>
    ),
  },
  {
  label: "Status",
  key: "status",
  render: (item: CardiolgyItems) => (
    <div className="CardilogyStatus">
      {item.status === "In-progress" ? (
        <h6 className=" progress" title="Done">
          In-progress
        </h6>
      ) : item.status === "off-duty" ? (
        <h6 className="on-duty" title="off-duty">
          Off-Duty
        </h6>
      ) : item.status === "Consulting" ? (
        <h6 className="on-Consulting" title="Consulting">
          Consulting
        </h6>
      ) : item.status === "break" ? (
        <h6 className="on-break" title="break">
          On Break
        </h6>
      ) : (
        <h6
          className="circle-btn view"
          title="View"
          onClick={() => console.log("View", item)}
        >
          Available
        </h6>
      )}
    </div>
  ),
},


  {
    label: "Actions",
    key: "actions",
    width: "60px",
    render: () => (
        <div className="Cardiologybtn">
            <Button> <FaEye size={24}/> </Button>
        </div>
    ),
  },

  




];



function CardiologyTable() {
  return (
    <>
    
      <div className="table-wrapper">
        <GenericTable data={Cardiolgy} columns={columns} bordered={false} />
      </div>

    </>
  )
}

export default CardiologyTable