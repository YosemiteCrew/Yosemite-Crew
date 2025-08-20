"use client";
import React, {useState } from "react";
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

function CreateTask() {

  //emails
  const [email, setEmail] = useState("")


  // high priority
  const [country, setCountry] = useState<string>("");
  type Option = {
    value: string;
    label: string;
  };
  const options: Option[] = [
    { value: 'us', label: '🇺🇸 United States' },
    { value: 'in', label: '🇮🇳 India' },
    { value: 'uk', label: '🇬🇧 United Kingdom' },
  ];

  // date of birth 
  const [name, setName] = useState({
    dateOfBirth: "",
  });
  const handleDateChange = (date: string | null) => {
    setName((prevData) => ({
      ...prevData,
      dateOfBirth: date || "",
    }));
  };

  // Search 
  const [search, setSearch] = useState("");
  const handleSearch = (e: React.FormEvent) => {
      e.preventDefault();
      // Implement search logic here
      alert(`Searching for: ${search}`);
  };


  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [apiFiles, setApiFiles] = useState<[]>([]);


  return (
    <>
    <section className='task-create-section'>
      <Container>
        <div className="TaskCreateData">

          <BackBtn href="/task" icon="solar:round-alt-arrow-left-outline" backtext="Back"/>

          <div className="CreateTaskDiv">
            <h2>Create Task</h2>
            <div className="CreateTaskItems">
              <p>Task Detail</p>
              <Row>
                <Col md={6}>
                  <FormInput intype="text"  inname="email"  value={email} inlabel="Task Title" onChange={(e) => setEmail(e.target.value)}/>
                </Col>
                <Col md={6}>
                  <FormInput intype="text"  inname="email"  value={email} inlabel="Task Category" onChange={(e) => setEmail(e.target.value)}/>
                </Col>
              </Row>
              <Row>
                <Col md={12}>
                  <FormInput intype="text"  inname="email"  value={email} inlabel="Description" onChange={(e) => setEmail(e.target.value)}/>
                </Col>
              </Row>
              <Row>
                <div className="TaskTimingPriority">
                  <p>Timing and Priority</p>
                  <DynamicSelect options={options} value={country} onChange={setCountry} inname="country" placeholder="High Priority"/>
                  <DynamicDatePicker placeholder="Start Date" value={name.dateOfBirth} onDateChange={handleDateChange}/>
                  <DynamicDatePicker placeholder="End Date" value={name.dateOfBirth} onDateChange={handleDateChange}/>
                </div>
              </Row>
              <Row>
                <Col md={6}>
                  <FormInput intype="text"  inname="email"  value={email} inlabel="Assigned To" onChange={(e) => setEmail(e.target.value)}/>
                    <span className="errorinput"> The Task is Assigned by Dr. David Brown </span>
                </Col>
                <Col md={6}>
                  <FormInput intype="text"  inname="email"  value={email} inlabel="Assigned Department" onChange={(e) => setEmail(e.target.value)}/>
                </Col>
              </Row>

            </div>
          </div>

          <div className="TaskPatientDiv">

            <div className="Patientsearch">
              <h6>Patient Detail</h6>
              <div className="RightTopTbl">
                <Form className="Tblserchdiv" onSubmit={handleSearch} >
                    <input
                    type="search"
                    placeholder="Search Pet name/Parent Name."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    />
                    <Button type="submit"><LuSearch size={20} /></Button>
                </Form>
              </div>
            </div>

            <Row>
              <Col md={6}>
                <FormInput intype="text"  inname="email"  value={email} inlabel="Patient Name" onChange={(e) => setEmail(e.target.value)}/>
              </Col>
              <Col md={6}>
                <FormInput intype="text"  inname="email"  value={email} inlabel="Parent Name" onChange={(e) => setEmail(e.target.value)}/>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <FormInput intype="text"  inname="email"  value={email} inlabel="Appointment Id" onChange={(e) => setEmail(e.target.value)}/>
              </Col>
              <Col md={6}>
                <div className="CreateTaskSelect">
                  <p>Task Status</p>
                  <DynamicSelect options={options} value={country} onChange={setCountry} inname="country" placeholder="Task Accepted"/>
                </div>
              </Col>
            </Row>

            <Row>
              <Col md={12}>
                <UploadImage value={uploadedFiles} onChange={setUploadedFiles} existingFiles={apiFiles} />
              </Col>
              
            </Row>

          </div>

          <div className="TaskCreateftBtn">
            <FillBtn icon={<Icon icon="solar:document-medicine-bold" width="24" height="24" />} text="Create Task" href="#" />
          </div>






        </div>
      </Container>
    </section>
      
    </>
  )
}

export default CreateTask
