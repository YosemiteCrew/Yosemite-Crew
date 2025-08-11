"use client";
import React, { useEffect, useState } from "react";
import "./Departments.css";
import ProfileProgressbar from "@/app/Components/ProfileProgressbar/ProfileProgressbar";
import { Container, FloatingLabel, Form } from "react-bootstrap";
import { FormInput } from "../Sign/SignUp";
import { PhoneInput } from "@/app/Components/PhoneInput/PhoneInput";
import { HeadText } from "../CompleteProfile/CompleteProfile";
import ServicesSelection from "@/app/Components/Services/ServicesSelection/ServicesSelection";
import DepartmentHeadSelector from "@/app/Components/Services/DepartmentHeadSelector/DepartmentHeadSelector";
import { getData, postData } from "@/app/axios-services/services";
import { convertDepartmentFromFHIR, convertFHIRToAdminDepartments, convertToFHIRDepartment } from "@yosemite-crew/fhir";
import { useAuthStore } from "@/app/stores/authStore";
import { FillBtn } from "../HomePage/HomePage";
import { Icon } from "@iconify/react/dist/iconify.js";
import DynamicSelect from "@/app/Components/DynamicSelect/DynamicSelect";

function AddDepartments() {
  const [progress] = useState(0);
  const [formData, setFormData] = useState({
    departmentId: "",
    email: "",
    biography: "",
  });
  const [servicesList, setServiceList] = useState([
    { code: "E001", display: "Cardiac Health Screenings" },
    { code: "S001", display: "Echocardiograms" },
    { code: "V001", display: "Electrocardiograms (ECG)" },
    { code: "D001", display: "Blood Pressure Monitoring" },
    { code: "H001", display: "Holter Monitoring" },
    { code: "G001", display: "Cardiac Catheterization" },
    { code: "T001", display: "Congenital Heart Disease Management" },
  ]);
  const [countryCode, setCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [department, setDepartments] = useState([]);
  const [services, setServices] = useState<string[]>([]);
  const [departmentHeadId, setDepartmentHeadId] = useState<string>("");
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

    if (!formData.departmentId.trim()) errors.name = "Department name is required.";
    if (!formData.biography.trim())
      errors.biography = "Description is required.";

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) errors.email = "Email is required.";
    else if (!emailRegex.test(formData.email))
      errors.email = "Invalid email format.";

    const phoneRegex = /^[0-9]{7,15}$/;
    if (!phone.trim()) errors.phone = "Phone number is required.";
    else if (!phoneRegex.test(phone))
      errors.phone = "Phone number must be 7–15 digits.";

    if (!countryCode) errors.countryCode = "Country code required.";
    if (services.length === 0) errors.services = "Select at least one service.";
    if (!departmentHeadId)
      errors.departmentHeadId = "Select a department head.";

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    const isValid = validateForm();
    if (!isValid) return;

    try {
      const fhirPayload = convertToFHIRDepartment({
        departmentId: formData.departmentId,
        biography: formData.biography,
        email: formData.email,
        phone,
        countrycode: countryCode,
        services,
        departmentHeadId,
        bussinessId: userId,
      });
      const res = await postData("/api/auth/HealthcareService", fhirPayload);
      if (res.status === 201) {
        alert("Department added or updated!");
      }
    } catch (err: any) {
      console.error("Failed to add or update department", err);
      alert(
        `${err.response?.data?.msg || "An error occurred while adding or updating the department."}`
      );
    }
  };

  useEffect(() => {
    const getDepartmentData = async () => {
      if (!formData.departmentId || !userId) return;

      try {
        const response = await getData(`/api/auth/getDepartmentAllData?Id=${formData.departmentId}&userId=${userId}`);
        if (response.status === 200) {
          const data: any = response.data;
          const fhir = convertDepartmentFromFHIR(data);
          setFormData({ email: fhir.email || "", biography: fhir.biography || "", departmentId: formData.departmentId });
          setPhone(fhir.phone || "");
          setCountryCode(fhir.countrycode || "+91");
          setDepartmentHeadId(fhir.departmentHeadId || "");
          const selectedServiceCodes = 
            Array.isArray(fhir.services)
              ? fhir.services
                  .map((serviceCode: string) => 
                    servicesList.find((s) => s.code === serviceCode)?.code
                  )
                  .filter((code): code is string => Boolean(code))
              : [];
          setServices(selectedServiceCodes);
        }
      } catch (error) {
        console.error("Failed to fetch department data:", error);
      }
    };
    getDepartmentData();
  }, [formData.departmentId, servicesList, userId]);

  useEffect(() => {
    const getDepartmentsList = async () => {
      if (!userId) return;

      try {
        const response = await getData(`/api/auth/getDepartments?userId=${userId}`);
        if (response?.data) {
          const data: any = response.data;
          const fhirData: any = convertFHIRToAdminDepartments(data.data);
          const formatted = fhirData.map((v: any) => ({
            value: v._id,
            label: v.name,
          }));
          setDepartments(formatted);
        }
      } catch (error) {
        console.error("Failed to fetch departments:", error);
      }
    };

    getDepartmentsList();
  }, [userId]);

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
                <DynamicSelect options={department} value={formData.departmentId} onChange={(v) => setFormData((pre) => ({ ...pre, departmentId: v }))} inname="departmentId" placeholder="Department Name" />
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
                      name="biography"
                      placeholder="Enter biography"
                      value={formData.biography}
                      onChange={handleChange}
                      style={{ height: "100px" }}
                    />
                  </FloatingLabel>
                  {formErrors.biography && (
                    <div className="text-danger small mt-1">
                      {formErrors.biography}
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
                {formErrors.countryCode && (
                  <div className="text-danger small mt-1">
                    {formErrors.countryCode}
                  </div>
                )}
              </div>

              <div className="DepartServicesDiv">
                <ServicesSelection
                  Title="Add Services"
                  services={servicesList}
                  selected={services}
                  onSelectionChange={setServices}
                />
                {formErrors.services && (
                  <div className="text-danger small">{formErrors.services}</div>
                )}
              </div>

              <DepartmentHeadSelector onSelectHead={setDepartmentHeadId} Head={departmentHeadId} />
              {formErrors.departmentHeadId && (
                <div className="text-danger small mt-1">{formErrors.departmentHeadId}</div>
              )}

              <div className="">
                <FillBtn onClick={handleSubmit} icon={<Icon icon="carbon:checkmark-filled" width="24" height="24" />} text="Add Department" href="#" />
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