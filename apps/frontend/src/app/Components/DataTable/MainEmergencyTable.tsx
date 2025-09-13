"use client";

import React, { useState, useEffect, useCallback } from "react";
import "./DataTable.css";
import GenericTable from "../GenericTable/GenericTable";
import { Button, Dropdown } from "react-bootstrap";
import { BsThreeDotsVertical } from "react-icons/bs";
import { FaEye, FaUser } from "react-icons/fa6";
import { getData, putData } from "@/app/axios-services/services";
import { convertEmergencyAppointmentFromFHIRForTable } from "@yosemite-crew/fhir";
import { NormalEmergencyAppointment } from "@yosemite-crew/types";
import { useOldAuthStore } from "@/app/stores/oldAuthStore";
import { useRouter } from "next/navigation";
import GenericTablePagination from "../GenericTable/GenericTablePagination";

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
    id: string;
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
                    <span className="owner">
                        <FaUser /> {item.owner}
                    </span>
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
        label: "Visit Time",
        key: "time",
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
                        <Dropdown.Item onClick={() => changeStatus(item, "inProgress", refreshData)}>
                            In-Progress
                        </Dropdown.Item>
                        <Dropdown.Item onClick={() => changeStatus(item, "checkedIn", refreshData)}>
                            Checked-In
                        </Dropdown.Item>
                        <Dropdown.Item onClick={() => changeStatus(item, "fulfilled", refreshData)}>
                            Completed
                        </Dropdown.Item>
                    </Dropdown.Menu>
                </Dropdown>
            </div>
        ),
    },
];

async function changeStatus(item: AppointmentItem, status: string, refreshCallback: () => void) {
    try {
        const response = await putData(`/fhir/v1/EmergencyAppointment/${item.id}`, {
            status: status,
        });
        console.log("Status update response for ID", item.id, ":", response.data);
        if (response.status === 200) {
            refreshCallback();
        }
    } catch (error) {
        console.error("Error updating appointment status:", error);
    }
}

function MainEmergencyTable({ onCountUpdate }: EmergencyDataTableProps) {
    const { userId } = useOldAuthStore();
    const router = useRouter();
    const [data, setData] = useState<AppointmentItem[]>([]);
    const [count, setCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [itemsPerPage] = useState(3);

    const normalizeAppointments = (appointments: NormalEmergencyAppointment[]): AppointmentItem[] => {
        return appointments.map((item: any) => {
            // Log raw status to debug
            console.log("Raw appointment status for ID", item._id, ":", item.appointmentStatus);

            // Map appointmentStatus to AppointmentStatus
            let mappedStatus: AppointmentStatus = "accepted";
            switch (item.appointmentStatus) {
                case "checkedIn":
                    mappedStatus = "Checked-In";
                    break;
                case "inProgress":
                    mappedStatus = "In-Progress";
                    break;
                case "fulfilled":
                    mappedStatus = "fulfilled";
                    break;
                case "cancelled":
                    mappedStatus = "cancelled";
                    break;
                case "Pending":
                    mappedStatus = "Pending";
                    break;
                case "accepted":
                    mappedStatus = "accepted";
                    break;
                default:
                    console.warn("Unknown appointment status:", item.appointmentStatus);
            }

            return {
                id: item._id,
                name: item.petName,
                owner: item.ownerName,
                appointmentId: item.tokenNumber,
                breed: item.petBreed || "-",
                pet: item.petType,
                time: item.appointmentTime,
                doctor: item.veterinarian,
                specialization: item.departmentName,
                status: mappedStatus,
                gender: item.gender,
            };
        });
    };

    const fetchEmergencyAppointments = useCallback(async () => {
        if (!userId) return;

        try {
            const response = await getData(`/fhir/v1/getEmergencyAppointment?userId=${userId}&page=${currentPage}&limit=${itemsPerPage}`);
            if (response.status === 200) {
                const data: any = response.data;
                const appointments: NormalEmergencyAppointment[] = data.data.map((appt: any) =>
                    convertEmergencyAppointmentFromFHIRForTable(appt)
                );
                const mappedData = normalizeAppointments(appointments);

                setData(mappedData);
                setCount(data.pagination.totalItems);
                setTotalPages(data.pagination.totalPages);

                if (onCountUpdate) {
                    onCountUpdate(data.pagination.totalItems);
                }
            }
        } catch (error) {
            console.error("Error fetching emergency appointments:", error);
        }
    }, [userId, currentPage, itemsPerPage, onCountUpdate]);

    useEffect(() => {
        fetchEmergencyAppointments();
    }, [fetchEmergencyAppointments]);

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    const columns = getColumns(fetchEmergencyAppointments);

    return (
        <div className="table-wrapper">
            <GenericTable data={data} columns={columns} bordered={false} />
            <div className="table-footerBtn">
                <GenericTablePagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={count}
                    itemsPerPage={itemsPerPage}
                    onPageChange={handlePageChange}
                />
            </div>
        </div>
    );
}

export default MainEmergencyTable;