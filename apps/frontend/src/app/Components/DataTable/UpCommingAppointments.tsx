"use client";
import React, { useEffect, useState, useCallback } from 'react'
import "./DataTable.css"
import GenericTable from '../GenericTable/GenericTable'
import { Button, Dropdown, Form } from 'react-bootstrap'
import { BsThreeDotsVertical } from 'react-icons/bs';
import Image from 'next/image';
import { FaCircleCheck, FaEye, FaUser } from 'react-icons/fa6';
import { getData, putData } from '@/app/axios-services/services';
import { LuSearch } from 'react-icons/lu';
import { fhirToNormalForTable } from '@yosemite-crew/fhir';

type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
};

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
  appointmentType?: string;
  participants: any;
  specialization: string;
  status: AppointmentStatus;
};

interface UpCommingAppointmentsProps {
  userId: string;
  onAppointmentUpdate: number; // Changed from function to number
  onCountUpdate: (count: number) => void;
  onRefreshAll: () => void; // Add this
}

function UpCommingAppointments({ userId, onAppointmentUpdate, onCountUpdate, onRefreshAll }: UpCommingAppointmentsProps) {
  const [data, setData] = useState<TodayAppointmentItem[]>([]);
  const [search, setSearch] = useState("");
  const [doctor, setDoctor] = useState("");
  const [selectedDoctorName, setSelectedDoctorName] = useState("Doctor");
  const [doctorOptions, setDoctorOptions] = useState<{ value: string; label: string }[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Added refresh trigger

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
        type: 'upcoming',
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
      console.error("Error fetching upcoming appointments:", error);
      onCountUpdate(0);
    }
  }, [userId, onCountUpdate, search, doctor]);

  useEffect(() => {
    fetchData();
    fetchDoctors();
  }, [fetchData, fetchDoctors, refreshTrigger, onAppointmentUpdate]); // Added dependencies

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

  async function markAsDone(item: TodayAppointmentItem) {
    try {
      const response = await putData(`/fhir/v1/updateAppointmentStatus/${item.id}`, {
        status: "fulfilled",
      });
      if (response.status === 200) {
        setRefreshTrigger(prev => prev + 1); // Refresh this component
        onRefreshAll(); // Refresh all components
      }
    } catch (error) {
      console.error("Error marking appointment as done:", error);
    }
  }

  const columns: Column<TodayAppointmentItem>[] = [
    {
      label: "",
      key: "avatar",
      width: "60px",
      render: (item: TodayAppointmentItem) => (
        <Image src={item.image} alt={item.name} width={40} height={40} style={{ borderRadius: "50%" }} />
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
      render: (item: TodayAppointmentItem) => <p>{item.petType}/{item.pet}</p>,
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
      render: (item: TodayAppointmentItem) => (
        <div className="action-btn-col">
          <Button
            className="circle-btn view"
            title="View"
          // onClick={() => handleViewAppointment(item)}
          // disabled={isLoading}
          >
            <FaEye size={20} />
          </Button>
        </div>
      ),
    },
    // {
    //   label: "",
    //   key: "actionsDropdown",
    //   render: (item: TodayAppointmentItem) => (
    //     <div className="action-dropdown">
    //       <Dropdown align="end">
    //         <Dropdown.Toggle as="span" className="custom-toggle">
    //           <BsThreeDotsVertical className="menu-icon" />
    //         </Dropdown.Toggle>
    //         <Dropdown.Menu>
    //           <Dropdown.Item onClick={() => console.log("Edit", item)}>Edit</Dropdown.Item>
    //           <Dropdown.Item onClick={() => console.log("Save", item)}>Save</Dropdown.Item>
    //           <Dropdown.Item onClick={() => console.log("Delete", item)}>Delete</Dropdown.Item>
    //         </Dropdown.Menu>
    //       </Dropdown>
    //     </div>
    //   ),
    // }
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
        <GenericTable data={data} columns={columns} bordered={false} pageSize={3} pagination />
      </div>
    </>
  );
}

export default UpCommingAppointments;