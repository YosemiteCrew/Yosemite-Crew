"use client";
import React from "react";
import GenericTable from "../GenericTable/GenericTable";
import Image from "next/image";
import { Button } from "react-bootstrap";
import { FaEye } from "react-icons/fa6";


type CardiolgyItems = {
  image: string;
  firstName: string;
  lastName: string;
  email: string;
  mobileNumber: string;
  week: string;
  time: string;
  status: string;
};

export const getCardiologyColumns = () => {
  return [
    {
      label: "",
      key: "avatar",
      width: "60px",
      render: (item: CardiolgyItems) => (
        <Image
          src={item.image}
          alt={item.image}
          width={40}
          height={40}
          style={{ borderRadius: "50%" }}
        />
      ),
    },
    {
      label: "Name",
      key: "name",
      render: (item: CardiolgyItems) => (
        <div>
          <p>{item.firstName}</p>
          <span>{item.lastName}</span>
        </div>
      ),
    },
    {
      label: "Email Address",
      key: "email",
      render: (item: CardiolgyItems) => <p>{item.email}</p>,
    },
    {
      label: "Phone Number",
      key: "phone",
      render: (item: CardiolgyItems) => <p>{item.mobileNumber}</p>,
    },
    {
      label: "Schedule",
      key: "schedule",
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
            <h6 className="progress">In-progress</h6>
          ) : item.status === "Off-Duty" ? (
            <h6 className="on-duty">Off-Duty</h6>
          ) : item.status === "Consulting" ? (
            <h6 className="on-Consulting">Consulting</h6>
          ) : item.status === "break" ? (
            <h6 className="on-break">On Break</h6>
          ) : (
            <h6
              className="circle-btn view"
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
          <Button>
            <FaEye size={24} />
          </Button>
        </div>
      ),
    },
  ];
};

type Props = {
  data?: CardiolgyItems[];
};

function CardiologyTable({ data = [] }: Props) {
  return (
    <div className="table-wrapper">
      <GenericTable data={data} columns={getCardiologyColumns()} bordered={false} />
    </div>
  );
}

export default CardiologyTable;