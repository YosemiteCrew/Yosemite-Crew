"use client";
import React from "react";
import "./DataTable.css";
import GenericTable from "../GenericTable/GenericTable";
import { Button, Dropdown } from "react-bootstrap";
import { BsThreeDotsVertical } from "react-icons/bs";
import Image from "next/image";
import { FaUser } from "react-icons/fa6";
import { Icon } from "@iconify/react/dist/iconify.js";
import { putData } from "@/app/axios-services/services";

// Unified status type
type AppointmentStatus = "In-progress" | "Checked-In" | "Pending" | "accepted" | "cancelled" | "fulfilled";

type TodayAppointmentItem = {
    id: string;
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

type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
};

interface NewAppointmentsProps {
  data: TodayAppointmentItem[];
  onAppointmentUpdate: () => void;
}

function getColumns(onAppointmentUpdate: () => void): Column<TodayAppointmentItem>[] {
  return [
    {
      label: "",
      key: "avatar",
      width: "60px",
      render: (item) => (
        <Image
          src={item.image || "/default-pet.png"}
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
      render: (item) => (
        <div className="user-info">
          <p className="name">{item.name}</p>
          <span className="owner">
            <FaUser /> {item.owner}
          </span>
        </div>
      ),
    },
    {
      label: "Appointment ID",
      key: "tokenNumber",
      render: (item) => <p>{item.tokenNumber}</p>,
    },
    {
      label: "Reason for Appointment",
      key: "reason",
      render: (item) => <p>{item.reason}</p>,
    },
    {
      label: "Breed/Pet",
      key: "pet",
      render: (item) => <p>{item.petType}/{item.pet}</p>,
    },
    {
      label: "Date",
      key: "date",
      render: (item) => (
        <div>
          <p>{item.time}</p>
          <span>{item.date}</span>
        </div>
      ),
    },
    {
      label: "Doctor",
      key: "doctor",
      render: (item) => (
        <div>
          <p>{item.participants.name || "Unknown Doctor"}</p>
          <span>{item.specialization || "No Department"}</span>
        </div>
      ),
    },
    {
      label: "Actions",
      key: "actions",
      render: (item) => (
        <div className="action-btn-col displx">
          <Button
            onClick={() => accept(item, onAppointmentUpdate)}
            className="circle-btn done"
            title="Accept"
            aria-label="Accept appointment"
          >
            <Icon icon="carbon:checkmark-filled" width="24" height="24" />
          </Button>
          <Button
            onClick={() => cancel(item, onAppointmentUpdate)}
            className="circle-btn cancel"
            title="Cancel"
            aria-label="Cancel appointment"
          >
            <Icon icon="icon-park-solid:close-one" width="24" height="24" />
          </Button>
        </div>
      ),
    },
    {
      label: "",
      key: "actionsDropdown",
      render: (item) => (
        <div className="action-dropdown">
          <Dropdown align="end">
            <Dropdown.Toggle as="span" className="custom-toggle">
              <BsThreeDotsVertical className="menu-icon" />
            </Dropdown.Toggle>
            <Dropdown.Menu>
              <Dropdown.Item onClick={() => console.log("Edit", item)}>Edit</Dropdown.Item>
              <Dropdown.Item onClick={() => console.log("Save", item)}>Save</Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        </div>
      ),
    },
  ];
}

async function accept(item: TodayAppointmentItem, onAppointmentUpdate: () => void) {
  try {
    const response = await putData(`/fhir/v1/updateAppointmentStatus/${item.id}`, {
      status: "accepted",
    });
    if (response.status === 200) {
      onAppointmentUpdate();
    } else {
      console.error("Failed to accept appointment");
    }
  } catch (error) {
    console.error("Error accepting appointment:", error);
  }
}

async function cancel(item: TodayAppointmentItem, onAppointmentUpdate: () => void) {
  try {
    const response = await putData(`/fhir/v1/updateAppointmentStatus/${item.id}`, {
      status: "cancelled",
    });
    if (response.status === 200) {
      onAppointmentUpdate();
    } else {
      console.error("Failed to cancel appointment");
    }
  } catch (error) {
    console.error("Error cancelling appointment:", error);
  }
}

function NewAppointments({ data, onAppointmentUpdate }: NewAppointmentsProps) {
  const columns = getColumns(onAppointmentUpdate);

  return (
    <div className="table-wrapper">
      <GenericTable data={data} columns={columns} bordered={false} pageSize={3}pagination />
    </div>
  );
}

export default NewAppointments;