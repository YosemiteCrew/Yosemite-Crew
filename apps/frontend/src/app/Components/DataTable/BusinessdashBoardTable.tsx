"use client";
import React, { useState, useCallback, useEffect, memo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "react-bootstrap";
import { FaEye, FaUser } from "react-icons/fa6";
import { fromFHIR } from "@yosemite-crew/fhir";
import { FHIRAppointmentData, MyAppointmentData } from "@yosemite-crew/types";

import { getData } from "@/app/services/axios";
import GenericTable from "@/app/components/GenericTable/GenericTable";
import { useOldAuthStore } from "@/app/stores/oldAuthStore";

import "./DataTable.css";

type AppointmentStatus =
  | "In-Progress"
  | "Checked-In"
  | "Pending"
  | "Confirmed"
  | "Cancelled"
  | "Fulfilled";

const validStatuses = [
  "accepted",
  "pending",
  "cancelled",
  "in-progress",
  "checked-in",
  "fulfilled",
];

export type TodayAppointmentItem = {
  id: string;
  name: string;
  owner: string;
  image: string;
  tokenNumber: string;
  reason: string;
  petType: string;
  pet?: string;
  time: string;
  date: string;
  doctorName: string;
  specialization: string;
  status: AppointmentStatus;
};

const columns = [
  {
    label: "",
    key: "avatar",
    width: "40px",
    render: (item: TodayAppointmentItem) => (
      <Image
        src={item.image}
        alt="avatar"
        width={40}
        height={40}
        className="PetImg"
      />
    ),
  },
  {
    label: "Name",
    key: "name",
    render: (item: TodayAppointmentItem) => (
      <div>
        <p>{item.name}</p>
        <div className="userinfo">
          <span>
            <FaUser />
          </span>
          {item.owner}
        </div>
      </div>
    ),
  },
  {
    label: "Appointment ID",
    key: "tokenNumber",
    render: (item: TodayAppointmentItem) => <p>{item.tokenNumber}</p>,
  },
  {
    label: "Reason for Appointment",
    key: "reason",
    render: (item: TodayAppointmentItem) => <p>{item.reason}</p>,
  },
  {
    label: "Pet Type",
    key: "petType",
    render: (item: TodayAppointmentItem) => <p>{item.petType}</p>,
  },
  {
    label: "Time",
    key: "time",
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
        <p>{item.doctorName}</p>
        <span>{item.specialization}</span>
      </div>
    ),
  },
  {
    label: "Actions",
    key: "actions",
    render: () => (
      <Button className="ActionEyes" aria-label="View">
        <FaEye />
      </Button>
    ),
  },
];

const BusinessdashBoardTable = ({ status }: Readonly<{ status?: string }>) => {
  const router = useRouter();
  const navigate = () => {
    router.push("/AppointmentVet");
  };
  const [appointmentsData, setAppointmentsData] = useState<
    TodayAppointmentItem[]
  >([]);
  const userId = useOldAuthStore((state: any) => state.userId);

  const normalizeAppointments = (
    data: MyAppointmentData[]
  ): TodayAppointmentItem[] => {
    return data.map((item: any) => {
      let mappedStatus: AppointmentStatus = "Pending";
      const status = item.appointmentStatus?.toLowerCase();

      if (status === "in-progress") mappedStatus = "In-Progress";
      else if (status === "checked-in") mappedStatus = "Checked-In";
      else if (status === "accepted") mappedStatus = "Confirmed";
      else if (status === "cancelled") mappedStatus = "Cancelled";
      else if (status === "fulfilled") mappedStatus = "Fulfilled";

      return {
        id: item._id,
        name: item.petName,
        owner: item.ownerName,
        image: item.petImage,
        tokenNumber: item.tokenNumber,
        reason: item.purposeOfVisit,
        petType: item.breed,
        pet: item.pet,
        time: item.appointmentTime,
        date: item.appointmentDate,
        doctorName: item.doctorName,
        specialization: item.departmentName,
        status: mappedStatus,
      };
    });
  };

  const getAppointments = useCallback(
    async (doctorId: string = "", statusFilter: string = "accepted") => {
      // Validate statusFilter
      const finalStatus = validStatuses.includes(statusFilter.toLowerCase())
        ? statusFilter.toLowerCase()
        : "accepted";

      try {
        const response = await getData(
          `/api/appointments/getAllAppointments?doctorId=${doctorId}&userId=${userId}&status=${finalStatus}`
        );
        if (response.status === 200) {
          const data: any = response.data;
          setAppointmentsData(
            normalizeAppointments(fromFHIR(data.data as FHIRAppointmentData[]))
          );
        }
      } catch (error) {
        setAppointmentsData([]);
        console.error("Error fetching appointments:", error);
      }
    },
    [userId]
  );

  useEffect(() => {
    if (userId) {
      getAppointments("", status);
    }
  }, [userId, status, getAppointments]);

  return (
    <div className="table-wrapper">
      {/* Limit to first 3 items */}
      <GenericTable
        data={appointmentsData.slice(0, 3)}
        columns={columns}
        bordered={false}
      />
      <div className="table-footerBtn ">
        <Button onClick={navigate}>See All</Button>
      </div>
    </div>
  );
};

export default memo(BusinessdashBoardTable);
