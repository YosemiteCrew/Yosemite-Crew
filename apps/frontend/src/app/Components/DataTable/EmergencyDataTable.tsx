"use client";
import React, { useState, useEffect, useCallback } from 'react'
import "./DataTable.css"
import GenericTable from '../GenericTable/GenericTable'
import { Button, Dropdown } from 'react-bootstrap'
import { BsThreeDotsVertical } from 'react-icons/bs';
import { FaEye, FaUser } from 'react-icons/fa6';
import { getData, putData } from '@/app/axios-services/services';
import { convertEmergencyAppointmentFromFHIRForTable } from '@yosemite-crew/fhir';
import { NormalEmergencyAppointment } from '@yosemite-crew/types';
import { useAuthStore } from '@/app/stores/authStore';
import { useRouter } from 'next/navigation';

// Define the Column type
type Column<T> = {
    label: string;
    key: keyof T | string;
    width?: string;
    render?: (item: T) => React.ReactNode;
};

// Type
type AppointmentStatus = "In-Progress" | "Checked-In" | "Pending" | "accepted" | "cancelled" | "fulfilled";

type AppointmentItem = {
    id:string;
    name: string;
    owner: string;
    appointmentId: string;
    breed: string;
    time: string;
    doctor: string;
    specialization: string;
    status: AppointmentStatus;
    pet: string;
    gender: string;
};

interface EmergencyDataTableProps {
  onCountUpdate?: (count: number) => void;
}

// Columns for GenericTable
const getColumns = (refreshData: () => void): Column<AppointmentItem>[] => [
    {
        label: "Name",
        key: "name",
        render: (item: AppointmentItem) => (
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
        render: (item: AppointmentItem) => <p>{item.appointmentId}</p>,
    },
    {
        label: "Breed/Pet",
        key: "breed",
        render: (item: AppointmentItem) => <p>{item.breed}/{item.pet}</p>,
    },
    {
        label: "Gender",
        key: "gender",
        render: (item: AppointmentItem) => <p>{item.gender}</p>,
    },
    {
        label: "Date",
        key: "date",
        render: (item: AppointmentItem) => (
            <div>
                <p>{item.time}</p>
            </div>
        ),
    },
    {
        label: "Doctor",
        key: "doctor",
        render: (item: AppointmentItem) => (
            <div>
                <p>{item.doctor}</p>
                <span>{item.specialization}</span>
            </div>
        ),
    },
    {
        label: "Actions",
        key: "actions",
        render: (item: AppointmentItem) => (
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
        render: (item: AppointmentItem) => (
            <div className="action-dropdown">
                <Dropdown align="end">
                    <Dropdown.Toggle as="span" className="custom-toggle">
                        <BsThreeDotsVertical className="menu-icon" />
                    </Dropdown.Toggle>
                    <Dropdown.Menu>
                        <Dropdown.Item onClick={() => changeStatus(item, "inProgress", refreshData)}>In-Progress</Dropdown.Item>
                        <Dropdown.Item onClick={() => changeStatus(item, "checkedIn", refreshData)}>Checked-In</Dropdown.Item>
                        <Dropdown.Item onClick={() => changeStatus(item, "fulfilled", refreshData)}>Completed</Dropdown.Item>
                    </Dropdown.Menu>
                </Dropdown>
            </div>
        ),
    }
];

async function changeStatus(item: AppointmentItem, status: string, refreshCallback: () => void) {
    try {
        const response = await putData(`/fhir/v1/EmergencyAppointment/${item.id}`, {
            status: status,
        });
        if (response.status === 200) {
            // Refresh the data after successful status change
            refreshCallback();
        }
    } catch (error) {
        console.error("Error accepting appointment:", error);
    }
}

function EmergencyDataTable({ onCountUpdate }: EmergencyDataTableProps) {
    const {userId} = useAuthStore()
    const router = useRouter();
    const navigate = () => {
        router.push('/EmergencyAppointment');
    };
    const [data, setData] = useState<AppointmentItem[]>([]);
    // const [isLoading, setIsLoading] = useState(true);
    const [count, setCount] = useState(0);
    
    const fetchEmergencyAppointments = useCallback(async () => {
        try {
            // setIsLoading(true);
            const response = await getData(`/fhir/v1/getEmergencyAppointment?userId=${userId}`);
            if (response.status === 200) {
                const data: any = response.data;
                const appointments: NormalEmergencyAppointment[] = data.data.map((appt: any) =>
                    convertEmergencyAppointmentFromFHIRForTable(appt)
                );
                // Map to the expected format for the table
                const mappedData = appointments.map((item: any) => ({
                    id: item._id,
                    name: item.petName,
                    owner: item.ownerName,
                    appointmentId: item.tokenNumber,
                    breed: item.petBreed || "-",
                    pet: item.petType,
                    time: item.appointmentTime,
                    doctor: item.veterinarian,
                    specialization: item.departmentName,
                    status: item.appointmentStatus,
                    gender: item.gender
                }));
                
                setData(mappedData);
                setCount(mappedData.length);
                // Notify parent component about the count
                if (onCountUpdate) {
                    onCountUpdate(mappedData.length);
                }
            }
        } catch (error) {
            console.error("Error fetching emergency appointments:", error);
        } finally {
            // setIsLoading(false);
        }
    }, [userId, onCountUpdate]);

    useEffect(() => {
        if (userId) {
            fetchEmergencyAppointments();
        }
    }, [userId, fetchEmergencyAppointments]);

    const columns = getColumns(fetchEmergencyAppointments);

    // if (isLoading) {
    //     return <div>Loading emergency appointments...</div>;
    // }

    return (
        <>
            <div className="table-wrapper">
                <GenericTable data={data} columns={columns} bordered={false} />
                <div className="table-footerBtn ">
                    <Button onClick={navigate}>See All</Button>
                </div>
            </div>
        </>
    )
}

export default EmergencyDataTable