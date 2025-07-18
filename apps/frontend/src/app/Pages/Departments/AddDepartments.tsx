"use client";
import React, { useState } from "react";
import "./Departments.css";
import ProfileProgressbar from "@/app/Components/ProfileProgressbar/ProfileProgressbar";
import { Button, Container, FloatingLabel, Form } from "react-bootstrap";
import { FormInput } from "../Sign/SignUp";
import { PhoneInput } from "@/app/Components/PhoneInput/PhoneInput";
import { HeadText } from "../CompleteProfile/CompleteProfile";
import ServicesSelection from "@/app/Components/Services/ServicesSelection/ServicesSelection";
import DepartmentHeadSelector from "@/app/Components/Services/DepartmentHeadSelector/DepartmentHeadSelector";
import axios from "axios";
import { postData } from "@/app/axios-services/services";
import { convertToFHIRDepartment } from "@yosemite-crew/fhir";
import { useStore } from "zustand";
import { useAuthStore } from "@/app/stores/authStore";

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
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    description: "",
  });

  const [countryCode, setCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [services, setServices] = useState<string[]>([]);
  const [conditionsTreated, setConditionsTreated] = useState<string[]>([]);
  const [departmentHeadId, setDepartmentHeadId] = useState<string>("");
  const [consultationModes, setConsultationModes] = useState<string[]>([]); // like ['in-person', 'virtual']
  const [loading, setLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const userId = useAuthStore((state: any) => state.userId);
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  // Utility: Validate form before submit
  const validateForm = (): boolean => {
    const errors: { [key: string]: string } = {};

    if (!formData.name.trim()) errors.name = "Department name is required.";
    if (!formData.description.trim())
      errors.description = "Description is required.";

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email))
      errors.email = "Invalid email format.";

    const phoneRegex = /^[0-9]{7,15}$/;
    if (!phoneRegex.test(phone))
      errors.phone = "Phone number must be 7–15 digits.";

    if (!countryCode) errors.countryCode = "Country code required.";
    if (services.length === 0) errors.services = "Select at least one service.";
    if (conditionsTreated.length === 0)
      errors.conditions = "Select at least one condition.";
    if (!departmentHeadId)
      errors.departmentHeadId = "Select a department head.";
    // if (consultationModes.length === 0) errors.consultationModes = 'Select consultation mode.';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    const isValid = validateForm();
    if (!isValid) return;

    try {
      const fhirPayload = convertToFHIRDepartment({
        departmentName: formData.name,
        description: formData.description,
        email: formData.email,
        phone,
        countrycode: countryCode,
        services,
        conditionsTreated,
        consultationModes,
        departmentHeadId,
        bussinessId: userId,
      });

      const res = await postData("/fhir/HealthcareService", fhirPayload);
      if (res.status === 201) {
        alert("Department added!");
      }
    } catch (err: any) {
      console.error("Failed to add department", err);
      alert(
        `${err.response?.data?.msg || "An error occurred while adding the department."}`
      );
    }
  };

  console.log(formErrors, "Form Data");

  return (
    <section className="AddSpecialitiesSec">
      <Container>
        <div className="mb-3">
          <HeadText blktext="Add" Spntext="Specialities" />
        </div>
        <div className="Add_Profile_Data">
          <div className="LeftProfileDiv">
            <div className="DepartMantAddData">
              <div className="DepartInputDiv">
                <FormInput
                  intype="text"
                  inname="name"
                  value={formData.name}
                  inlabel="Department Name"
                  onChange={handleChange}
                />
                {formErrors.name && (
                  <div className="text-danger small mt-1">
                    {formErrors.name}
                  </div>
                )}
                <div className="DepartFormTexediv">
                  <FloatingLabel
                    className="textarealabl"
                    controlId="floatingTextarea2"
                    label="Biography/Short Description"
                  >
                    <Form.Control
                      as="textarea"
                      name="description"
                      placeholder="Enter description"
                      value={formData.description}
                      onChange={handleChange}
                      style={{ height: "100px" }}
                    />
                  </FloatingLabel>
                  {formErrors.description && (
                    <div className="text-danger small mt-1">
                      {formErrors.description}
                    </div>
                  )}
                </div>

                <FormInput
                  intype="email"
                  inname="email"
                  value={formData.email}
                  inlabel="Email Address"
                  onChange={handleChange}
                />
                {formErrors.email && (
                  <div className="text-danger small mt-1">
                    {formErrors.email}
                  </div>
                )}
                <PhoneInput
                  countryCode={countryCode}
                  onCountryCodeChange={setCountryCode}
                  phone={phone}
                  onPhoneChange={setPhone}
                />
                {formErrors.phone && (
                  <div className="text-danger small mt-1">
                    {formErrors.phone}
                  </div>
                )}
              </div>

              <div className="DepartServicesDiv">
                <ServicesSelection
                  Title="Add Services"
                  services={servicesList}
                  onSelectionChange={setServices}
                />
              </div>

              <DepartmentHeadSelector onSelectHead={setDepartmentHeadId} />

              <div className="DepartServicesDiv">
                <ServicesSelection
                  Title="Conditions Treated"
                  services={ConditionsList}
                  onSelectionChange={setConditionsTreated}
                />
                {formErrors.services && (
                  <div className="text-danger small">{formErrors.services}</div>
                )}
              </div>

              <div className="text-end mt-3">
                <Button variant="primary" onClick={handleSubmit}>
                  Save Department
                </Button>
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
  );
}

export default AddDepartments;
