'use client';
import React, { useState } from 'react';
import "./Departments.css"
import ProfileProgressbar from '@/app/Components/ProfileProgressbar/ProfileProgressbar';
import { Container, FloatingLabel, Form } from 'react-bootstrap';
import { FormInput } from '../Sign/SignUp';
import { PhoneInput } from '@/app/Components/PhoneInput/PhoneInput';
import { HeadText } from '../CompleteProfile/CompleteProfile';
import ServicesSelection from '@/app/Components/Services/ServicesSelection/ServicesSelection';
import DepartmentHeadSelector from '@/app/Components/Services/DepartmentHeadSelector/DepartmentHeadSelector';


const servicesList = [
  { code: "E001", display: "Cardiac Health Screenings" },
  { code: "S001", display: "Echocardiograms" },
  { code: "V001", display: "Electrocardiograms (ECG)" },
  { code: "D001", display: "Blood Pressure Monitoring" },
  { code: "H001", display: "Holter Monitoring" },
  { code: "G001", display: "Cardiac Catheterization" },
  { code: "T001", display: "Congenital Heart Disease Management" },
];

const ConditionsList = [
  { code: "E001", display: "Congestive Heart Failure" },
  { code: "S001", display: "Arrhythmias" },
  { code: "V001", display: "Heart Murmurs" },
  { code: "D001", display: "Dilated Cardiomyopathy" },
  { code: "H001", display: "Valvular Heart Disease" },
  { code: "G001", display: "Pericardial Effusion" },
  { code: "T001", display: "Myocarditis" },
];



function AddDepartments() {

  const [progress] = useState(0);
  const [name, setName] = useState({ 
    name: "",
    email: "",
  });
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName({ ...name, [e.target.name]: e.target.value });
  };
    // Add state for phone and country code
  const [countryCode, setCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  const handleServiceSelectionChange = (selectedServices: string[]) => {
    setSelectedServices(selectedServices);
  };



  return (
    <>
    <section className='AddSpecialitiesSec'>
      <Container>

        <div className="mb-3">
          <HeadText blktext="Add" Spntext="Specialities" />
        </div>
        <div className="Add_Profile_Data">
          <div className="LeftProfileDiv">
            <div className="DepartMantAddData">

              <div className='DepartInputDiv'>
                <FormInput intype="text" inname="name"  value={name.name} inlabel="Department Name" onChange={handleChange}/>
                <div className="DepartFormTexediv">
                    <FloatingLabel className="textarealabl" controlId="floatingTextarea2" label="Biography/Short Description">
                        <Form.Control
                        as="textarea"
                        placeholder="Leave a comment here"
                        style={{ height: '100px' }}
                        />
                    </FloatingLabel>
                </div>
                <FormInput intype="email" inname="email"  value={name.email} inlabel="Email Address" onChange={handleChange}/>
                <PhoneInput countryCode={countryCode}  onCountryCodeChange={setCountryCode} phone={phone} onPhoneChange={setPhone}/>
              </div>

              <div className="DepartServicesDiv">
                <ServicesSelection Title="Add Services" services={servicesList} onSelectionChange={handleServiceSelectionChange}/>
              </div>

              <DepartmentHeadSelector />

              <div className="DepartServicesDiv">
                <ServicesSelection Title="Conditions Treated" services={ConditionsList} onSelectionChange={handleServiceSelectionChange}/>
              </div>

            </div>
          </div>

          <div className="RytProfileDiv">
            <ProfileProgressbar
              blname="Profile"
              spname="Progress"
              progres={progress}
            />
          </div>

        </div>



      </Container>
    </section>
    




    </>
  )
}

export default AddDepartments