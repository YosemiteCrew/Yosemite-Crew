"use client";
import React, { useEffect, useState, useCallback } from 'react'
import "./DataTable.css"
import GenericTable from '../GenericTable/GenericTable'
import { Button, Dropdown } from 'react-bootstrap'
import { BsThreeDotsVertical } from 'react-icons/bs';
import Image from 'next/image';
import { FaEye, FaUser } from 'react-icons/fa6';
import { getData, putData } from '@/app/axios-services/services';
import { fhirToNormalForTable } from '@yosemite-crew/fhir';
import { useAuthStore } from '@/app/stores/authStore';
import { useRouter } from 'next/navigation';

type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
};

type AppointmentStatus = "In-Progress" | "Checked-In" | "Pending" | "accepted" | "cancelled" | "fulfilled";

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
  veterinarianId?: string;
};

interface DashboardTodayAppointmentsTableProps {
  onAppointmentUpdate: number;
  onCountUpdate: (count: number) => void;
}

function DashboardTodayAppointmentsTable({ onAppointmentUpdate, onCountUpdate }: DashboardTodayAppointmentsTableProps) {
  const { userId } = useAuthStore();
  const router = useRouter();
  const navigate = () => {
    router.push('/AppointmentVet');
  };
  const [data, setData] = useState<TodayAppointmentItem[]>([]);
  // const [status, setStatus] = useState("");
  // const [doctor, setDoctor] = useState("");
  // const [selectedDoctorName, setSelectedDoctorName] = useState("Doctor");
  // const [doctorOptions, setDoctorOptions] = useState<{ value: string; label: string }[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // const fetchDoctors = useCallback(async () => {
  //   if (!userId) return;

  //   try {
  //     const response = await getData(`/fhir/v1/practiceDoctors?userId=${userId}`);
  //     if (response.status === 200) {
  //       const data: any = response.data;
  //       const doctors = data.data.map((doc: any) => ({
  //         value: doc.id || doc.userId,
  //         label: doc.name || "Unknown",
  //       }));
  //       setDoctorOptions([{ value: "", label: "Doctor" }, ...doctors]);
  //     }
  //   } catch (error) {
  //     console.error("Error fetching doctors:", error);
  //   }
  // }, [userId]);

  const fetchData = useCallback(async () => {
    if (!userId) return;

    try {
      const params = new URLSearchParams({
        userId: userId,
        type: 'today',
        limit: '1000'
      });

      if (status) params.append('status', status);

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
      console.error("Error fetching today appointments:", error);
      onCountUpdate(0);
    }
  }, [userId, onCountUpdate]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshTrigger, onAppointmentUpdate]);

  const normalizeAppointments = (appointments: any[]): TodayAppointmentItem[] => {
    return appointments.map((item: any) => {
      let mappedStatus: AppointmentStatus = "accepted";
      if (item.appointmentStatus === "checkedIn") mappedStatus = "Checked-In";
      else if (item.appointmentStatus === "inProgress") mappedStatus = "In-Progress";

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
        veterinarianId: item.veterinarianId
      };
    });
  };

  async function changeStatus(item: TodayAppointmentItem, status: string) {
    try {
      const response = await putData(`/fhir/v1/updateAppointmentStatus/${item.id}`, {
        status: status,
      });
      if (response.status === 200) {
        setRefreshTrigger(prev => prev + 1);
      }
    } catch (error) {
      console.error("Error accepting appointment:", error);
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
        item.status === "accepted" ? (
          <div className="action-btn-col">
            <Button
              className="circle-btn view"
              title="View"
            >
              <FaEye size={20} />
            </Button>
          </div>
        ) : (
          <div className="status-col">
            <span
              className={`status-badge ${item.status.replace(/\s+/g, '-').toLowerCase()}`}
            >
              <span>●</span> {item.status}
            </span>
          </div>
        )
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
              <Dropdown.Item onClick={() => changeStatus(item, "inProgress")}>In-Progress</Dropdown.Item>
              <Dropdown.Item onClick={() => changeStatus(item, "checkedIn")}>Checked-In</Dropdown.Item>
              <Dropdown.Item onClick={() => changeStatus(item, "fulfilled")}>Completed</Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        </div>
      ),
    }
  ];

  return (
    <>
      {/* <div className="hh">
        <div className="RightTopTbl">
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
      </div> */}

      <div className="table-wrapper">
        <GenericTable data={data} columns={columns} bordered={false} pageSize={3} pagination />
        <div className="table-footerBtn ">
          <Button onClick={navigate}>See All</Button>
        </div>
      </div>
    </>
  );
}

export default DashboardTodayAppointmentsTable;