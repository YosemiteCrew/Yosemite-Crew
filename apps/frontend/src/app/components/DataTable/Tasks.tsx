import React, { useState } from "react";
import GenericTable from "../GenericTable/GenericTable";
import Link from "next/link";
import { FaCheckCircle } from "react-icons/fa";
import { IoIosCloseCircle } from "react-icons/io";

import "./DataTable.css";

type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
};

type TasksProps = {
  task: string;
  description: string;
  category: string;
  from: string;
  to: string;
  toLabel: string;
  due: string;
  status: string;
};

const demoData: TasksProps[] = [
  {
    task: "Follow up with new client",
    description: "Send onboarding documents and schedule first meeting.",
    category: "Client Relations",
    from: "John Carter",
    to: "Evergreen Veterinary Clinic",
    toLabel: "Organisations",
    due: "2025-11-07",
    status: "Pending",
  },
  {
    task: "Update vaccination records",
    description: "Verify and upload updated vaccine certificates for pets.",
    category: "Records Management",
    from: "Emily Davis",
    to: "Sarah Wilson",
    toLabel: "Companions",
    due: "2025-11-08",
    status: "In-Progress",
  },
  {
    task: "Prepare monthly billing report",
    description: "Generate and review invoices for October.",
    category: "Finance",
    from: "Michael Brown",
    to: "Happy Tails Clinic",
    toLabel: "Organisations",
    due: "2025-11-10",
    status: "Pending",
  },
  {
    task: "Check medication stock",
    description: "Ensure all essential medicines are in adequate supply.",
    category: "Inventory",
    from: "Anna Lee",
    to: "Dr. Roberts",
    toLabel: "Companions",
    due: "2025-11-09",
    status: "Completed",
  },
  {
    task: "Design promotional banner",
    description: "Create social media banner for the new wellness campaign.",
    category: "Marketing",
    from: "Rachel Green",
    to: "Healthy Paws Veterinary",
    toLabel: "Organisations",
    due: "2025-11-12",
    status: "Pending",
  },
];

const Tasks = () => {
  const [data] = useState<TasksProps[]>(demoData);

  const columns: Column<TasksProps>[] = [
    {
      label: "Task",
      key: "task",
      width: "15%",
      render: (item: TasksProps) => (
        <div className="appointment-profile-title">{item.task}</div>
      ),
    },
    {
      label: "Description",
      key: "description",
      width: "20%",
      render: (item: TasksProps) => (
        <div className="appointment-profile-title">{item.description}</div>
      ),
    },
    {
      label: "Category",
      key: "category",
      width: "10%",
      render: (item: TasksProps) => (
        <div className="appointment-profile-title">{item.category}</div>
      ),
    },
    {
      label: "From",
      key: "from",
      width: "10%",
      render: (item: TasksProps) => (
        <div className="appointment-profile-title">{item.from}</div>
      ),
    },
    {
      label: "To",
      key: "to",
      width: "10%",
      render: (item: TasksProps) => (
        <div className="appointment-profile-two">
          <div className="appointment-profile-title">{item.to}</div>
          <div className="appointment-profile-sub">{item.toLabel}</div>
        </div>
      ),
    },
    {
      label: "Due date",
      key: "due",
      width: "10%",
      render: (item: TasksProps) => (
        <div className="appointment-profile-title">{item.due}</div>
      ),
    },

    {
      label: "Status",
      key: "status",
      width: "15%",
      render: (item: TasksProps) => (
        <div className="appointment-status">{item.status}</div>
      ),
    },
    {
      label: "Actions",
      key: "actions",
      width: "10%",
      render: (item: TasksProps) => (
        <div className="action-btn-col">
          <Link
            href={"#"}
            className="action-btn"
            style={{ background: "#E6F4EF" }}
          >
            <FaCheckCircle size={22} color="#54B492" />
          </Link>
          <div className="action-btn" style={{ background: "#FDEBEA" }}>
            <IoIosCloseCircle size={24} color="#EA3729" />
          </div>
        </div>
      ),
    },
  ];
  return (
    <div className="table-wrapper">
      <div className="table-list">
        <GenericTable data={data} columns={columns} bordered={false} />
      </div>
    </div>
  );
};

export default Tasks;
