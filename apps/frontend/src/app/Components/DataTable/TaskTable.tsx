"use client";
import React, { useState } from 'react'
import "./DataTable.css";
import { Button, Dropdown, Form } from 'react-bootstrap'
import { LuSearch } from 'react-icons/lu'
import GenericTable from '../GenericTable/GenericTable';
import { BsThreeDotsVertical } from 'react-icons/bs';
import { Icon } from '@iconify/react/dist/iconify.js';
import { FaUser } from 'react-icons/fa6';
import Image from 'next/image';





// Define the Column type
type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
};



type TaskItem = {

  task: string;
  category: string;
  duedate1: string;
  duedate2: string;
  description: string;
  name: string;
  owner: string;
  appointid: string;
  doctor: string;
  specialization: string;
  status: string;
};

// Sample Data
const appointments: TaskItem[] = [
  {
    task: "Laboratory",
    category: "Routine Blood Test",
    duedate1: "28 Aug 2025",
    duedate2: "01 Sep 2025",
    description: "Routine Blood Test for health check-up",
    name: "Kizie",
    owner: "Sky B",
    appointid: "DR001-03-23-2024",
    doctor: "Dr. Emily Johnson",
    specialization: "Cardiology",
    status: "Completed",
  },
  {
    task: "Laboratory",
    category: "Routine Blood Test",
    duedate1: "28 Aug 2025",
    duedate2: "01 Sep 2025",
    description: "Routine Blood Test for health check-up",
    name: "Kizie",
    owner: "Sky B",
    appointid: "DR001-03-23-2024",
    doctor: "Dr. Emily Johnson",
    specialization: "Cardiology",
    status: "Progress",
  },
  {
    task: "Laboratory",
    category: "Routine Blood Test",
    duedate1: "28 Aug 2025",
    duedate2: "01 Sep 2025",
    description: "Routine Blood Test for health check-up",
    name: "Kizie",
    owner: "Sky B",
    appointid: "DR001-03-23-2024",
    doctor: "Dr. Emily Johnson",
    specialization: "Cardiology",
    status: "Pending",
  },
  {
    task: "Laboratory",
    category: "Routine Blood Test",
    duedate1: "28 Aug 2025",
    duedate2: "01 Sep 2025",
    description: "Routine Blood Test for health check-up",
    name: "Kizie",
    owner: "Sky B",
    appointid: "DR001-03-23-2024",
    doctor: "Dr. Emily Johnson",
    specialization: "Cardiology",
    status: "",
  },


];

// Columns for GenericTable
const columns: Column<TaskItem>[] = [
    
  {
    label: "Task",
    key: "task",
    render: (item: TaskItem) => (
      <p>{item.task}</p>
    ),
  },

  {
    label: "Task Category",
    key: "category",
    width: "139px",
    render: (item: TaskItem) => <p className='text-ellipsis'>{item.category}</p>,
},

{
  label: "Due Date",
  key: "duedate",
  width: "150px",
  render: (item: TaskItem) => 
    <div>
      <p>{item.duedate1}</p>
      <span>{item.duedate2}</span>
    </div>,
  
},

{
  label: "Task Description",
  key: "description",
  
  render: (item: TaskItem) => <p className='text-ellipsis' style={{maxWidth:"128px"}}>{item.description}</p>,
},

  {
    label: "Name",
    key: "name",
    width: "150px",
    render: (item: TaskItem) =>
    <div>
        <p className="name">{item.name}</p>
        <span className="owner"><FaUser /> {item.owner}</span>
    </div>,
  },

  {
    label: "Appointment ID",
    key: "appointid",
    render: (item: TaskItem) => (
      <p className='text-ellipsis' style={{maxWidth:"168px"}}>{item.appointid}</p>
    ),
  },

  {
    label: "Assigned By Department",
    key: "assignedBy",
    width: "150px",
    render: (item: TaskItem) => (
      <div>
        <p>{item.doctor}</p>
        <span>{item.specialization}</span>
      </div>
    ),
  },

  {
    label: "Document",
    key: "doct",
    width: "78px",
    render: () => (
      <div className='text-center'>
        <Button className='removebtn'>
            <Icon icon="solar:file-download-bold" width="24" height="24" color='#302F2E' />
        </Button>
      </div>
    ),
  },

  {
    label: "Task Status",
    key: "actions",
    width: "115px",
    render: (item: TaskItem) => (
        <>
        <div className="TaskStatusDiv">

          <div className="TaskStatus">
            {item.status === "Completed" ? (
              <h6 className="on-complete"><span className='dots'></span> Completed</h6>
            ) : item.status === "Progress" ? (
              <h6 className="on-progress"><span className='dots'></span> In-progress</h6>
            ) : item.status === "Pending" ? (
              <h6 className="on-pending"><span className='dots'></span> Pending</h6>
            ) : (
              <h6 className="Accepted"> Accepted</h6>
            )}
          </div>

          <div className="action-dropdown">
              <Dropdown align="end">
                  <Dropdown.Toggle as="span" className="custom-toggle">
                  <BsThreeDotsVertical className="menu-icon" />
                  </Dropdown.Toggle>
                  <Dropdown.Menu>
                  <Dropdown.Item onClick={() => console.log("Edit", item)}>Edit</Dropdown.Item>
                  <Dropdown.Item onClick={() => console.log("Save", item)}>Save</Dropdown.Item>
                  <Dropdown.Item onClick={() => console.log("Delete", item)}>Delete</Dropdown.Item>
                  </Dropdown.Menu>
              </Dropdown>
          </div>

        </div>
      </>
    ),
  },
  


];









function TaskTable() {

    const [selectedDepart, setSelectedDepart] = useState("Department");
    const [selectedStatus, setSelectedStatus] = useState("Status");
    const [search, setSearch] = useState("");
    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        // Implement search logic here
        alert(`Searching for: ${search}`);
    };


  return (
    <>
        <div className="TableDropdownWrapper">

            <div className="TableTopTexed">
                <div className="LeftTopTbl">
                    <h3>All Task (<span>03</span>)</h3>
                </div>
                <div className="RightTopTbl">
                    <Form className="Tblserchdiv" onSubmit={handleSearch} >
                        <input
                        type="search"
                        placeholder="Search Task, category, or Patient name"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        />
                        <Button type="submit"><LuSearch size={20} /></Button>
                    </Form>
                    <div className="StatusSlect">
                        <Dropdown onSelect={val => setSelectedDepart(val || "Doctor")}>
                        <Dropdown.Toggle id="status-dropdown" >
                            {selectedDepart}
                        </Dropdown.Toggle>
                        <Dropdown.Menu>
                            <Dropdown.Item eventKey="Status">Status</Dropdown.Item>
                            <Dropdown.Item eventKey="Pending">Pending</Dropdown.Item>
                            <Dropdown.Item eventKey="Completed">Completed</Dropdown.Item>
                            <Dropdown.Item eventKey="Cancelled">Cancelled</Dropdown.Item>
                        </Dropdown.Menu>
                        </Dropdown>
                    </div>
                    <div className="StatusSlect">
                        <Dropdown onSelect={val => setSelectedStatus(val || "Status")}>
                        <Dropdown.Toggle id="status-dropdown" >
                            {selectedStatus}
                        </Dropdown.Toggle>
                        <Dropdown.Menu>
                            <Dropdown.Item eventKey="Status">Status</Dropdown.Item>
                            <Dropdown.Item eventKey="Pending">Pending</Dropdown.Item>
                            <Dropdown.Item eventKey="Completed">Completed</Dropdown.Item>
                            <Dropdown.Item eventKey="Cancelled">Cancelled</Dropdown.Item>
                        </Dropdown.Menu>
                        </Dropdown>
                    </div>
                    
                </div>
            </div>

             <div className="table-wrapper">
                <GenericTable data={appointments} columns={columns} bordered={false} pagination pageSize={6} />
            </div>



        </div>

       
      
    </>
  )
}

export default TaskTable
