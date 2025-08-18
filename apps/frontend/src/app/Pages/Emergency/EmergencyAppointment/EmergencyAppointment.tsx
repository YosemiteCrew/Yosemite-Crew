"use client";
import React, { useEffect, useState } from "react";
import "./EmergencyAppointment.css";
import { Col, Container, Form, Row } from "react-bootstrap";
import StatCard from "@/app/Components/StatCard/StatCard";
import { OverviewDisp } from "../../Departments/DepartmentsDashboard";
import AllAppointmentsTable from "@/app/Components/DataTable/AllAppointmentsTable";
import NewEmergency from "@/app/Components/DataTable/NewEmergencyTable";
import { Icon } from "@iconify/react/dist/iconify.js";
import { FormInput } from "../../Sign/SignUp";
import { UnFillBtn } from "../../HomePage/HomePage";
import { PhoneInput } from "@/app/Components/PhoneInput/PhoneInput";
import DynamicSelect from "@/app/Components/DynamicSelect/DynamicSelect";
import Swal from "sweetalert2";
import { getData, postData } from "@/app/axios-services/services";
import { useAuthStore } from "@/app/stores/authStore";
import { convertDoctorsFromFHIR, convertEmergencyAppointmentToFHIR } from "@yosemite-crew/fhir";
import catBreedList from "./catBreedList.json";
import dogBreedList from "./dogBreedList.json";
import horseBreedList from "./horseBreedList.json";
import { NormalEmergencyAppointment } from "@yosemite-crew/types";

interface NameData {
  gender: string;
  mobileNumber: string;
}

interface Option {
  value: string;
  label: string;
}

interface doctors {
  value: string;
  label: string;
  dep: string;
}

interface AppointmentData {
  name: string;
  owner: string;
  image: string;
  reason: string;
  breed: string;
  pet: string;
  time: string;
  date: string;
  doctor: string;
  specialization: string;
  status: string;
}

function EmergencyAppointment() {
  const { userId } = useAuthStore();
  const [email, setEmail] = useState("");
  const [patientName, setPatientName] = useState("");
  const [parentName, setParentName] = useState("");
  const [breed, setBreed] = useState("");
  const [veterinarian, setVeterinarian] = useState("");
  const [petType, setPetType] = useState("");
  const [options, setOptions] = useState<doctors[]>([{ value: "", label: "", dep: "" }]);
  const [name, setName] = useState<NameData>({
    gender: "",
    mobileNumber: "",
  });
  const [departmentId, setDepartmentId] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [breeds, setBreeds] = useState<Option[]>([{ value: "", label: "" }]);
  const [errors, setErrors] = useState<{
    email?: string;
    patientName?: string;
    parentName?: string;
    breed?: string;
    petType?: string;
    gender?: string;
    mobileNumber?: string;
    veterinarian?: string;
  }>({});

  useEffect(() => {
    if (veterinarian) {
      const selectedDoctor = options.find((v) => v.value === veterinarian);
      if (selectedDoctor) {
        setDepartmentId(selectedDoctor.dep);
      }
    }
  }, [options, veterinarian]);

  useEffect(() => {
    if (petType === "Cat") {
      setBreeds(catBreedList.map((v) => ({ value: v.name, label: v.name })));
      setBreed("");
    } else if (petType === "Dog") {
      setBreeds(dogBreedList.map((v) => ({ value: v.name, label: v.name })));
      setBreed("");
    } else if (petType === "Horse") {
      setBreeds(horseBreedList.map((v) => ({ value: v.name, label: v.name })));
      setBreed("");
    } else {
      setBreeds([{ value: "", label: "" }]);
      setBreed("");
    }
  }, [petType]);

  useEffect(() => {
    if (!userId) return;

    let isMounted = true;

    const getDoctors = async () => {
      try {
        const response = await getData(`/fhir/v1/doctors?userId=${userId}`);
        const data: any = response.data;
        if (response.status === 200 && Array.isArray(data.data)) {
          const doctors = convertDoctorsFromFHIR(data.data);
          if (isMounted) {
            setOptions(
              doctors.map((v) => ({
                label: v.fullName,
                dep: v.department,
                value: v.cognitoId,
              }))
            );
          }
        }
      } catch (error) {
        console.error("Error fetching doctors:", error);
      }
    };

    getDoctors();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  const [appointmentData, setAppointmentData] = useState<AppointmentData[]>([
    {
      name: "Buddy",
      owner: "John Doe",
      image: "/Images/default-pet.png",
      reason: "Injury",
      breed: "Golden Retriever",
      pet: "Dog",
      time: "10:00 AM",
      date: "2025-08-13",
      doctor: "Dr. Smith",
      specialization: "Orthopedics",
      status: "new",
    },
    {
      name: "Luna",
      owner: "Jane Smith",
      image: "/Images/default-pet.png",
      reason: "Seizure",
      breed: "Persian",
      pet: "Cat",
      time: "11:30 AM",
      date: "2025-08-13",
      doctor: "Dr. Jones",
      specialization: "Neurology",
      status: "pending",
    },
  ]);

  const petTypeOptions: Option[] = [
    { value: "Dog", label: "Dog" },
    { value: "Cat", label: "Cat" },
    { value: "Horse", label: "Horse" },
    { value: "Other", label: "Other" },
  ];

  // Handle gender selection
  const handleGenderClick = (gender: string) => {
    setName((prevData) => ({
      ...prevData,
      gender,
    }));
    setErrors((prev) => ({ ...prev, gender: undefined }));
  };

  // Validate form fields
  const validateForm = () => {
    const newErrors: typeof errors = {};

    if (!email) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = "Invalid email format";
    if (!patientName) newErrors.patientName = "Patient name is required";
    if (!parentName) newErrors.parentName = "Parent name is required";
    if (!breed && petType !== "Other") newErrors.breed = "Breed is required";
    if (!petType) newErrors.petType = "Pet type is required";
    if (!name.gender) newErrors.gender = "Gender is required";
    if (!name.mobileNumber) newErrors.mobileNumber = "Phone number is required";
    else if (!/^\d{10}$/.test(name.mobileNumber)) newErrors.mobileNumber = "Phone number must be 10 digits";
    if (!veterinarian) newErrors.veterinarian = "Veterinarian is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Form submit
  const handleFormSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
  
      if (!validateForm()) {
        return;
      }
  
      const allData:NormalEmergencyAppointment = {
        email,
        ownerName: parentName,
        petName: patientName,
        petBreed: breed,
        petType: petType,
        gender: name.gender,
        phoneNumber: name.mobileNumber,
        department: departmentId,
        veterinarian,
        userId: userId,
        countryCode,
      };
         const data =convertEmergencyAppointmentToFHIR(allData)
      try {
        const response = await postData(`/fhir/v1/createappointment`, { data });
  
        if (response.status === 201 || response.status === 200) {
          Swal.fire({
            icon: "success",
            title: "Success",
            text: "Emergency appointment form submitted successfully.",
            timer: 2000,
            showConfirmButton: false,
          });
  
          // Reset form
          setEmail("");
          setPatientName("");
          setParentName("");
          setBreed("");
          setPetType("");
          setVeterinarian("");
          setName({ gender: "", mobileNumber: "" });
          setCountryCode("+91");
          setErrors({});
        }
      } catch (error) {
        console.error("Error submitting emergency appointment:", error);
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "Failed to submit emergency appointment.",
          timer: 2000,
          showConfirmButton: false,
        });
      }
    };

  return (
    <section className="EmergencyAppoitSec">
      <Container>
        <div className="EmergencyVetData">
          <div className="TopEmergencyVet">
            <div className="EmergencyHeading">
              <h2>Emergency Appointment</h2>
              <span>Total: {appointmentData.length}</span>
            </div>
            <div className="Emergencyoverview">
              <OverviewDisp hideTitle={false} showDropdown={false} titleText="Overview" />
              <Row>
                <Col md={3}>
                  <StatCard
                    icon="solar:document-medicine-bold"
                    title="Total Appointments"
                    value={appointmentData.length.toString()}
                  />
                </Col>
                <Col md={3}>
                  <StatCard
                    icon="solar:star-bold"
                    title="New Appointments"
                    value={appointmentData.filter((item) => item.status === "new").length.toString()}
                  />
                </Col>
              </Row>
            </div>
            {/* <AllAppointmentsTable data={appointmentData} /> */}
          </div>
          {/* <NewEmergency data={appointmentData.filter((item) => item.status === "new")} /> */}
          <EmergencyAppointForm
            email={email}
            setEmail={(value) => {
              setEmail(value);
              setErrors((prev) => ({ ...prev, email: undefined }));
            }}
            patientName={patientName}
            setPatientName={(value) => {
              setPatientName(value);
              setErrors((prev) => ({ ...prev, patientName: undefined }));
            }}
            parentName={parentName}
            setParentName={(value) => {
              setParentName(value);
              setErrors((prev) => ({ ...prev, parentName: undefined }));
            }}
            breed={breed}
            setBreed={(value) => {
              setBreed(value);
              setErrors((prev) => ({ ...prev, breed: undefined }));
            }}
            name={name}
            handleGenderClick={handleGenderClick}
            breeds={breeds}
            petType={petType}
            setPetType={(value) => {
              setPetType(value);
              setErrors((prev) => ({ ...prev, petType: undefined }));
            }}
            veterinarian={veterinarian}
            setVeterinarian={(value) => {
              setVeterinarian(value);
              setErrors((prev) => ({ ...prev, veterinarian: undefined }));
            }}
            options={options}
            petTypeOptions={petTypeOptions}
            countryCode={countryCode}
            setCountryCode={(value) => {
              setCountryCode(value);
              setErrors((prev) => ({ ...prev, mobileNumber: undefined }));
            }}
            setName={(value) => {
              setName(value);
              setErrors((prev) => ({ ...prev, mobileNumber: undefined }));
            }}
            onSubmit={handleFormSubmit}
            errors={errors}
          />
        </div>
      </Container>
    </section>
  );
}

export default EmergencyAppointment;

export interface EmergencyAppointFormProps {
  email: string;
  setEmail: React.Dispatch<React.SetStateAction<string>>;
  patientName: string;
  setPatientName: React.Dispatch<React.SetStateAction<string>>;
  parentName: string;
  setParentName: React.Dispatch<React.SetStateAction<string>>;
  breed: string;
  setBreed: React.Dispatch<React.SetStateAction<string>>;
  name: NameData;
  handleGenderClick: (gender: string) => void;
  petType: string;
  setPetType: React.Dispatch<React.SetStateAction<string>>;
  veterinarian: string;
  setVeterinarian: React.Dispatch<React.SetStateAction<string>>;
  options: Option[];
  breeds: Option[];
  petTypeOptions: Option[];
  countryCode: string;
  setCountryCode: React.Dispatch<React.SetStateAction<string>>;
  setName: React.Dispatch<React.SetStateAction<NameData>>;
  onSubmit: (e: React.FormEvent) => void;
  errors: {
    email?: string;
    patientName?: string;
    parentName?: string;
    breed?: string;
    petType?: string;
    gender?: string;
    mobileNumber?: string;
    veterinarian?: string;
  };
}

export function EmergencyAppointForm({
  email,
  setEmail,
  patientName,
  setPatientName,
  parentName,
  setParentName,
  breed,
  setBreed,
  name,
  handleGenderClick,
  petType,
  setPetType,
  veterinarian,
  setVeterinarian,
  options,
  breeds,
  petTypeOptions,
  countryCode,
  setCountryCode,
  setName,
  onSubmit,
  errors,
}: EmergencyAppointFormProps) {
  return (
    <div className="EmergencyFormDiv">
      <div className="FormItems">
        <h6>Emergency Form</h6>
        <Form onSubmit={onSubmit}>
          <Row>
            <Col md={6}>
              <FormInput
                intype="text"
                inname="patientName"
                value={patientName}
                inlabel="Patient Name"
                onChange={(e) => setPatientName(e.target.value)}
                error={errors?.patientName}
              />
            </Col>
            <Col md={6}>
              <FormInput
                intype="text"
                inname="parentName"
                value={parentName}
                inlabel="Parent Name"
                onChange={(e) => setParentName(e.target.value)}
                error={errors?.parentName}
              />
            </Col>
          </Row>
          <Row>
            <Col md={6}>
              <DynamicSelect
                options={petTypeOptions}
                value={petType}
                onChange={setPetType}
                inname="petType"
                placeholder="Pet Type"
                error={errors?.petType}
              />
            </Col>
            <Col md={6}>
              <DynamicSelect
                options={breeds}
                value={breed}
                onChange={setBreed}
                inname="breeds"
                placeholder="Breeds"
                error={errors?.breed}
              />
            </Col>
          </Row>
          <Row>
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
                {errors?.gender && <Form.Text className="text-danger">{errors?.gender}</Form.Text>}
              </div>
            </Col>
            <Col md={6}>
              <DynamicSelect
                options={options}
                value={veterinarian}
                onChange={setVeterinarian}
                inname="referTo"
                placeholder="Refer to"
                error={errors?.veterinarian}
              />
            </Col>
          </Row>
          <Row>
            <Col md={6}>
              <PhoneInput
                countryCode={countryCode}
                onCountryCodeChange={setCountryCode}
                phone={name.mobileNumber}
                onPhoneChange={(value) => setName({ ...name, mobileNumber: value })}
                error={errors?.mobileNumber}
              />
            </Col>
            <Col md={6}>
              <FormInput
                intype="email"
                inname="email"
                value={email}
                inlabel="Email"
                onChange={(e) => setEmail(e.target.value)}
                error={errors?.email}
              />
            </Col>
          </Row>
          <div className="EmerFormBtn">
            <UnFillBtn
              href=""
              icon={<Icon icon="solar:calendar-mark-bold" width="24" height="24" />}
              text="Create Emergency"
              onClick={onSubmit}
            />
          </div>
        </Form>
      </div>
    </div>
  );
}