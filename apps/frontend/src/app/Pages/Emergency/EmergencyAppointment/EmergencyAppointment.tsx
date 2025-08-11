"use client";
import React, { useState } from "react";
import "./EmergencyAppointment.css"
import { Button, Col, Container, Form, Row } from 'react-bootstrap'
import StatCard from '@/app/Components/StatCard/StatCard'
import { OverviewDisp } from '../../Departments/DepartmentsDashboard'
import AllAppointmentsTable from '@/app/Components/DataTable/AllAppointmentsTable'
import NewEmergency from '@/app/Components/DataTable/NewEmergencyTable'
import { Icon } from '@iconify/react/dist/iconify.js'
import { FormInput } from '../../Sign/SignUp'
import { UnFillBtn } from "../../HomePage/HomePage";
import DynamicDatePicker from "@/app/Components/DynamicDatePicker/DynamicDatePicker";
import { PhoneInput } from "@/app/Components/PhoneInput/PhoneInput";
import DynamicSelect from "@/app/Components/DynamicSelect/DynamicSelect";

function EmergencyAppointment() {

  const [email, setEmail] = useState("")
  const [name, setName] = useState({
    dateOfBirth: "",
    gender: "",
    mobileNumber: "",
  });
  // Use this handler for date picker:
  const handleDateChange = (date: string | null) => {
    setName((prevData) => ({
      ...prevData,
      dateOfBirth: date || "",
    }));
  };

  // Gender 
  const handleGenderClick = (gender: string) => {
    setName((prevData) => ({
      ...prevData,
      gender,
    }));
  };
  // Gender 
  // Add state for phone and country code
  const [countryCode, setCountryCode] = useState("+91");

  //Specialization Options
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



  return (
    <>
      <section className='EmergencyAppoitSec'>
          <Container>
            <div className="EmergencyVetData">

              <div className="TopEmergencyVet">
                <div className="EmergencyHeading">
                  <h2>Emergency Appointment</h2> 
                  <span>No New Appointments</span>
                </div>
                <div className="Emergencyoverview">
                  <OverviewDisp hideTitle={false} showDropdown={false} titleText="Overview" />
                  <Row>
                    <Col md={3}><StatCard icon="solar:document-medicine-bold" title="Total Appointments" value="03" /></Col>
                    <Col md={3}><StatCard icon="solar:star-bold" title="New Appointments" value="03" /></Col> 
                  </Row>
                </div>
                <AllAppointmentsTable/>
              </div>

              <NewEmergency/>



              {EmergencyAppointForm(email, setEmail, name, handleGenderClick, options, country, setCountry, countryCode, setCountryCode, setName, handleDateChange)}



            </div>
          </Container>
      </section>



    </>
  )
}

export default EmergencyAppointment





export function EmergencyAppointForm(email: string, setEmail: React.Dispatch<React.SetStateAction<string>>, name: { dateOfBirth: string; gender: string; mobileNumber: string; }, handleGenderClick: (gender: string) => void, options: { value: string; label: string; }[], country: string, setCountry: React.Dispatch<React.SetStateAction<string>>, countryCode: string, setCountryCode: React.Dispatch<React.SetStateAction<string>>, setName: React.Dispatch<React.SetStateAction<{ dateOfBirth: string; gender: string; mobileNumber: string; }>>, handleDateChange: (date: string | null) => void) {
  
  return <div className="EmergencyFormDiv">
    <div className="FormItems">
      <h6>Emergency Form</h6>
      <Form>
        <Row>
          <Col md={6}>
            <FormInput intype="text" inname="email" value={email} inlabel="Patient Name" onChange={(e) => setEmail(e.target.value)} />
          </Col>
          <Col md={6}>
            <FormInput intype="number" inname="email" value={email} inlabel="Appointment ID" onChange={(e) => setEmail(e.target.value)} />
          </Col>
        </Row>
        <Row>
          <Col md={6}>
            <FormInput intype="text" inname="email" value={email} inlabel="Parent Name" onChange={(e) => setEmail(e.target.value)} />
          </Col>
          <Col md={6}>
            <div className="FormGendr">
              <p>Gender</p>
              <ul className="SelectUl">
                {["Male", "Female", "Other"].map((gender) => (
                  <li
                    key={gender}
                    className={name.gender === gender ? "active" : ""}
                    onClick={() => handleGenderClick(gender)}
                  >
                    {gender}
                  </li>
                ))}
              </ul>
            </div>
          </Col>
        </Row>
        <Row>
          <Col md={6}>
            <DynamicSelect options={options} value={country} onChange={setCountry} inname="country" placeholder="Pet Type" />
          </Col>
          <Col md={6}>
            <DynamicSelect options={options} value={country} onChange={setCountry} inname="country" placeholder="Refer to" />
          </Col>
        </Row>
        <Row>
          <Col md={6}>
            <PhoneInput countryCode={countryCode} onCountryCodeChange={setCountryCode} phone={name.mobileNumber}
              onPhoneChange={(value) => setName({ ...name, mobileNumber: value })} />
          </Col>
          <Col md={6}>
            <DynamicDatePicker
              placeholder="Date of Birth"
              value={name.dateOfBirth}
              onDateChange={handleDateChange} />
          </Col>
        </Row>

        <div className="EmerFormBtn">
          <UnFillBtn href="#" icon={<Icon icon="solar:calendar-mark-bold" width="24" height="24" />} text="Create Emergency" />
        </div>

      </Form>


    </div>


  </div>;
}
