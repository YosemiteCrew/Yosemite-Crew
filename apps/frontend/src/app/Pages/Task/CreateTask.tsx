"use client";
import React, { useEffect, useState } from "react";
import './Task.css'
import { Button, Col, Container, Form, Row } from 'react-bootstrap'
import { BackBtn } from '../AddVetProfile/AddProileDetails'
import { FormInput } from '../Sign/SignUp'
import DynamicSelect from "@/app/Components/DynamicSelect/DynamicSelect";
import DynamicDatePicker from "@/app/Components/DynamicDatePicker/DynamicDatePicker";
import { FillBtn } from "../HomePage/HomePage";
import { Icon } from "@iconify/react/dist/iconify.js";
import { LuSearch } from "react-icons/lu";
import UploadImage from "@/app/Components/UploadImage/UploadImage";
import { getData, postData } from "@/app/axios-services/services";
import { convertFromFhirDepartment, convertFromFHIRDoctorOptions, convertTaskToFHIR } from "@yosemite-crew/fhir";
import { useAuthStore } from "@/app/stores/authStore";

function CreateTask() {
  const { userId } = useAuthStore()
  const [formData, setFormData] = useState({
    taskTitle: "",
    taskCategory: "",
    description: "",
    priority: "",
    startDate: null,
    endDate: null,
    assignedTo: "",
    assignedDepartment: "",
    patientName: "",
    parentName: "",
    appointmentId: "",
    search: "",
  });
  console.log("formDta", formData)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [apiFiles, setApiFiles] = useState<[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<{ value: string; label: string }[]>([]);
  const [practitionar, setPractitionar] = useState<{ value: string; label: string }[]>([]);
  // Options for priority dropdown
  const priorityOptions = [
    { value: 'High Priority', label: 'High Priority' },
    { value: 'Medium Priority', label: 'Medium Priority' },
    { value: 'Low Priority', label: 'Low Priority' },
  ];

  // Options for assigned department dropdown

  useEffect(() => {
    const getDepartment = async () => {
      try {
        const response = await getData(`/fhir/v1/getDepartmentForInvite?userId=${userId}`);
        if (response.status === 200) {
          const data = response.data as { data: any[] };
          const departments = convertFromFhirDepartment(data.data).map((dept: any) => ({
            value: dept._id,
            label: dept.name
          }));
          setDepartmentOptions(departments);
        } else {
          console.error("Failed to fetch departments:", response.statusText);
        }
      } catch (error) {
        let errorMessage = "Failed to fetch departments.";
        if (error && typeof error === "object" && "response" in error) {
          const res = (error as any).response;
          errorMessage = res?.data?.message || errorMessage;
        }
        console.error(errorMessage, error);
      }
    };
    getDepartment();
  }, [userId]);
   useEffect(() => {
          const getDoctors = async () => {
              if (!formData.assignedDepartment) return;
  
  
              try {
                  const response = await getData(
                      `/fhir/v1/PractistionarToCreateTask?userId=${userId}&departmentId=${formData.assignedDepartment}`
                  );
  
                  if (response.data) {
                      const data: any = response.data;
                      setPractitionar(convertFromFHIRDoctorOptions(data.data));
                  }
              } catch (error) {
                  console.error("Error fetching doctors:", error);
              }
          };
          getDoctors();
      }, [userId, formData.assignedDepartment]);
  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prevData => ({ ...prevData, [name]: value }));
  };

  // Handle date changes
  const handleDateChange = (name: string, date: string | null) => {
    setFormData(prevData => ({ ...prevData, [name]: date }));
  };

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`Searching for: ${formData.search}`);
  };

  const handleCreateTask = async () => {
    console.log("hello")
    try {
      const fhirTask = convertTaskToFHIR(formData); // build FHIR without files

      const formDataObj = new FormData();
      // Attach FHIR JSON (stringified)
      formDataObj.append("fhirTask", JSON.stringify(fhirTask));

      // Attach files directly
      uploadedFiles.forEach((file) => {
        formDataObj.append("files", file);
      });

      // Send single request
      const res = await postData("/fhir/v1/createtask", formDataObj, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      console.log("Task created:", res.data);
    } catch (err) {
      console.error("Error creating task:", err);
    }
  };


  return (
    <section className='task-create-section'>
      <Container>
        <div className="TaskCreateData">
          <BackBtn href="/task" icon="solar:round-alt-arrow-left-outline" backtext="Back" />

          <div className="CreateTaskDiv">
            <h2>Create Task</h2>
            <div className="CreateTaskItems">
              <p>Task Detail</p>
              <Row>
                <Col md={6}>
                  <FormInput intype="text" inname="taskTitle" value={formData.taskTitle} inlabel="Task Title" onChange={handleChange} />
                </Col>
                <Col md={6}>
                  <FormInput intype="text" inname="taskCategory" value={formData.taskCategory} inlabel="Task Category" onChange={handleChange} />
                </Col>
              </Row>
              <Row>
                <Col md={12}>
                  <FormInput intype="text" inname="description" value={formData.description} inlabel="Description" onChange={handleChange} />
                </Col>
              </Row>
              <Row>
                <div className="TaskTimingPriority">
                  <p>Timing and Priority</p>
                  <DynamicSelect options={priorityOptions} value={formData.priority} onChange={(value) => setFormData(prevData => ({ ...prevData, priority: value }))} inname="priority" placeholder="High Priority" />
                  <DynamicDatePicker placeholder="Start Date" value={formData.startDate} onDateChange={(date) => handleDateChange("startDate", date)} />
                  <DynamicDatePicker placeholder="End Date" value={formData.endDate} onDateChange={(date) => handleDateChange("endDate", date)} />
                </div>
              </Row>
              <Row>
                <Col md={6}>
                  <DynamicSelect options={departmentOptions} value={formData.assignedDepartment} onChange={(value) => setFormData(prevData => ({ ...prevData, assignedDepartment: value }))} inname="assignedDepartment" placeholder="Assigned Department" />
                </Col>
                <Col md={6}>
                  <DynamicSelect options={practitionar} value={formData.assignedTo} onChange={(value) => setFormData(prevData => ({ ...prevData, assignedTo: value }))} inname="assignedDepartment" placeholder="Assigned Department" />
                </Col>
              </Row>
            </div>
          </div>

          <div className="TaskPatientDiv">
            <div className="Patientsearch">
              <h6>Patient Detail</h6>
              <div className="RightTopTbl">
                <Form className="Tblserchdiv" onSubmit={handleSearch}>
                  <input
                    type="search"
                    placeholder="Search Pet name/Parent Name."
                    name="search"
                    value={formData.search}
                    onChange={handleChange}
                  />
                  <Button type="submit"><LuSearch size={20} /></Button>
                </Form>
              </div>
            </div>

            <Row>
              <Col md={6}>
                <FormInput intype="text" inname="patientName" value={formData.patientName} inlabel="Patient Name" onChange={handleChange} />
              </Col>
              <Col md={6}>
                <FormInput intype="text" inname="parentName" value={formData.parentName} inlabel="Parent Name" onChange={handleChange} />
              </Col>
            </Row>

            <Row>
              <Col md={12}>
                <FormInput intype="text" inname="appointmentId" value={formData.appointmentId} inlabel="Appointment Id" onChange={handleChange} />
              </Col>
            </Row>

            <Row>
              <Col md={12}>
                <UploadImage value={uploadedFiles} onChange={setUploadedFiles} existingFiles={apiFiles} />
              </Col>
            </Row>
          </div>

          <div className="TaskCreateftBtn">
            <FillBtn
              icon={<Icon icon="solar:document-medicine-bold" width="24" height="24" />}
              text="Create Task"
              href="/tasks"
              onClick={(e) => {
                e.preventDefault();
                handleCreateTask(); // ✅ call your function
              }}
            />          </div>
        </div>
      </Container>
    </section>
  );
}

export default CreateTask