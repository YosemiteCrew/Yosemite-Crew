"use client";
import React, { useEffect, useState, useCallback } from "react";
import "./DataTable.css";
import GenericTable from "../GenericTable/GenericTable";
import { Button, Dropdown, Form } from "react-bootstrap";
import { BsThreeDotsVertical } from "react-icons/bs";
import Image from "next/image";
import { FaEye, FaUser } from "react-icons/fa6";
import { Icon } from "@iconify/react/dist/iconify.js";
import { putData, getData } from "@/app/axios-services/services";
import { LuSearch } from 'react-icons/lu';
import { fhirToNormalForTable } from "@yosemite-crew/fhir";

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
  appointmentType?: string;
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
  userId: string;
  onAppointmentUpdate: number; // Changed from function to number
  onCountUpdate: (count: number) => void;
  onRefreshAll: () => void; // Add this
}

function NewAppointments({ userId, onAppointmentUpdate, onCountUpdate, onRefreshAll }: NewAppointmentsProps) {
  const [data, setData] = useState<TodayAppointmentItem[]>([]);
  const [search, setSearch] = useState("");
  const [doctor, setDoctor] = useState("");
  const [selectedDoctorName, setSelectedDoctorName] = useState("Doctor");
  const [doctorOptions, setDoctorOptions] = useState<{ value: string; label: string }[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Add refresh trigger

  const fetchDoctors = useCallback(async () => {
    if (!userId) return;

    try {
      const response = await getData(`/fhir/v1/practiceDoctors?userId=${userId}`);
      if (response.status === 200) {
        const data: any = response.data;
        const doctors = data.data.map((doc: any) => ({
          value: doc.id || doc.userId,
          label: doc.name || "Unknown",
        }));
        setDoctorOptions([{ value: "", label: "Doctor" }, ...doctors]);
      }
    } catch (error) {
      console.error("Error fetching doctors:", error);
    }
  }, [userId]);

  const fetchData = useCallback(async () => {
    if (!userId) return;

    try {
      const params = new URLSearchParams({
        userId: doctor || userId,
        type: 'new',
        limit: '1000'
      });

      if (search) params.append('search', search);

      const response = await getData(
        `/fhir/v1/getAllAppointmentsToAction?${params.toString()}`
      );

      if (response.status === 200) {
        const responseData: any = response.data;
        const backToNormal = fhirToNormalForTable(responseData.fhirData);
        const normalizedData = normalizeAppointments(backToNormal.Appointments);
        setData(normalizedData);
        onCountUpdate(backToNormal.totalAppointments || 0);
      }
    } catch (error) {
      setData([]);
      console.error("Error fetching new appointments:", error);
      onCountUpdate(0);
    }
  }, [userId, onCountUpdate, search, doctor]);

  useEffect(() => {
    fetchData();
    fetchDoctors();
  }, [fetchData, fetchDoctors, refreshTrigger, onAppointmentUpdate]); // Add refreshTrigger and onAppointmentUpdate to dependencies

  const normalizeAppointments = (appointments: any[]): TodayAppointmentItem[] => {
    return appointments.map((item: any) => {
      let mappedStatus: AppointmentStatus = "Pending";
      if (item.appointmentStatus === "accepted") mappedStatus = "Checked-In";
      else if (item.appointmentStatus === "fulfilled") mappedStatus = "In-progress";
      else if (item.appointmentStatus === "pending") mappedStatus = "Pending";

      return {
        id: item._id,
        name: item.petName,
        owner: item.ownerName,
        image: item.petImage || "/default-pet.png",
        tokenNumber: item.tokenNumber,
        reason: item.purposeOfVisit,
        petType: item.pet,
        pet: item.breed,
        time: item.appointmentTime,
        date: item.appointmentDate,
        appointmentType: item.appointmentType || "",
        participants: { name: item.doctorName || "Unknown Doctor" },
        specialization: item.departmentName,
        status: mappedStatus,
      };
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  async function accept(item: TodayAppointmentItem) {
    try {
      const response = await putData(`/fhir/v1/updateAppointmentStatus/${item.id}`, {
        status: "accepted",
      });
      if (response.status === 200) {
        // Refresh this component's data
        setRefreshTrigger(prev => prev + 1);
        // Refresh all other components
        onRefreshAll();
      }
    } catch (error) {
      console.error("Error accepting appointment:", error);
    }
  }

  async function cancel(item: TodayAppointmentItem) {
    try {
      const response = await putData(`/fhir/v1/updateAppointmentStatus/${item.id}`, {
        status: "cancelled",
      });
      if (response.status === 200) {
        // Refresh this component's data
        setRefreshTrigger(prev => prev + 1);
        // Refresh all other components
        onRefreshAll();
      }
    } catch (error) {
      console.error("Error cancelling appointment:", error);
    }
  }

  const getColumns = (): Column<TodayAppointmentItem>[] => [
    {
      label: "",
      key: "avatar",
      width: "60px",
      render: (item) => (
        <Image src={item.image || "/default-pet.png"} alt={item.name} width={40} height={40} style={{ borderRadius: "50%" }} />
      ),
    },
    {
      label: "Name",
      key: "name",
      render: (item) => (
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
          <Button onClick={() => accept(item)} className="circle-btn done" title="Accept">
            <Icon icon="carbon:checkmark-filled" width="24" height="24" />
          </Button>
          <Button onClick={() => cancel(item)} className="circle-btn cancel" title="Cancel">
            <Icon icon="icon-park-solid:close-one" width="24" height="24" />
          </Button>
          <Button className="circle-btn view" title="View" onClick={() => console.log("View", item)}>
            <FaEye size={20} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="hh">
        <div className="RightTopTbl">
          <Form className="Tblserchdiv" onSubmit={handleSearch}>
            <input
              type="search"
              placeholder="Search anything"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button type="submit"><LuSearch size={20} /></Button>
          </Form>

          <div className="DoctSlect">
            <Dropdown onSelect={(val) => {
              setDoctor(val || "");
              const selected = doctorOptions?.find(d => d.value === val);
              setSelectedDoctorName(selected?.label || "Doctor");
            }}>
              <Dropdown.Toggle id="doctor-dropdown">
                {selectedDoctorName}
              </Dropdown.Toggle>
              <Dropdown.Menu>
                {doctorOptions?.map((doc) => (
                  <Dropdown.Item eventKey={doc.value} key={doc.value}>
                    {doc.label}
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown>
          </div>
        </div>
      </div>

      <div className="table-wrapper">
        <GenericTable data={data} columns={getColumns()} bordered={false} pageSize={3} pagination />
      </div>
    </>
  );
}

export default NewAppointments;