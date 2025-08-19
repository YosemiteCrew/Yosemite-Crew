"use client";
import React, { useCallback, useEffect, useState } from "react";
import "./DoctorDashboard.css";
import { Col, Container, Row } from "react-bootstrap";
import Image from "next/image";
import Link from "next/link";
import StatCard from "@/app/Components/StatCard/StatCard";
import { HeadingDiv } from "../BusinessDashboard/BusinessDashboard";
import EmergencyAppointmentsTable from "@/app/Components/DataTable/EmergencyAppointmentsTable";
import { FaCalendar } from "react-icons/fa6";
import CalendarCard from "@/app/Components/CalendarCard/CalendarCard";
import { useAuthStore } from "@/app/stores/authStore";
import { getData, postData, putData } from "@/app/axios-services/services";
import Swal from "sweetalert2";
import { EmergencyAppointForm } from "../Emergency/EmergencyAppointment/EmergencyAppointment";
import DoctorSlots from "./DoctorSlots";
import { convertDoctorsFromFHIR, convertEmergencyAppointmentFromFHIRForTable, convertEmergencyAppointmentToFHIR, fromFHIR } from "@yosemite-crew/fhir";
import { MyAppointmentData, NormalEmergencyAppointment } from "@yosemite-crew/types";
import catBreedList from "../Emergency/EmergencyAppointment/catBreedList.json";
import dogBreedList from "../Emergency/EmergencyAppointment/dogBreedList.json";
import horseBreedList from "../Emergency/EmergencyAppointment/horseBreedList.json";
import EmergencyDataTable from "@/app/Components/DataTable/EmergencyDataTable";

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

function DoctorDashboard() {
  const { vetAndTeamsProfile, userId, fetchVetAndTeamsProfile, userType } = useAuthStore();
  const [available, setAvailable] = useState(true);
  const [addNewLead, setAddNewLead] = useState(false);
  const [appointmentData, setAppointmentData] = useState<MyAppointmentData[]>([]);
  const [options, setOptions] = useState<doctors[]>([{ value: "", label: "", dep: "" }]);

  // State for EmergencyAppointForm
  const [email, setEmail] = useState("");
  const [patientName, setPatientName] = useState("");
  const [parentName, setParentName] = useState("");
  const [breed, setBreed] = useState("");
  const [petType, setPetType] = useState("");
  const [veterinarian, setVeterinarian] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [breeds, setBreeds] = useState<Option[]>([{ value: "", label: "" }]);
  const [name, setName] = useState<NameData>({
    gender: "",
    mobileNumber: "",
  });
  const [emergencyAppointmentData, setEmergencyAppointmentData] = useState<NormalEmergencyAppointment[]>([]);
  console.log("Emergency Appointment Data:", emergencyAppointmentData);
  const [errors, setErrors] = useState<{
    email?: string;
    patientName?: string;
    parentName?: string;
    breed?: string;
    petType?: string;
    gender?: string;
    mobileNumber?: string;
    veterinarian?: string;
  }>({}); // Initialize errors state

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
      setBreed(""); // Reset breed when petType changes
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

  // Handle form submission


  useEffect(() => {
    setAvailable(vetAndTeamsProfile?.name.status === "On-Duty" ? true : false);
  }, [vetAndTeamsProfile]);

  const updateAvailability = async () => {
    const status = available ? "Off-Duty" : "On-Duty";
    try {
      const response = await putData(
        `/fhir/v1/updateAvailability?userId=${userId}&status=${status}`
      );
      if (response.status === 200) {
        Swal.fire({
          icon: "success",
          title: "Update Status!",
          text: "The Status has Updated.",
          timer: 2000,
          showConfirmButton: false,
        });
      }
      await fetchVetAndTeamsProfile(userId as string);
    } catch (error) {
      console.log("error");
    }
  };

  useEffect(() => {
    const getTodayAppointment = async (doctorId: string, status: string) => {
      try {
        const response = await getData(
          `/api/appointments/getAllAppointments?doctorId=${doctorId}&userId=${userId}&status=${status}`
        );
        if (response.status === 200) {
          const data: any = response.data;
          setAppointmentData(fromFHIR(data.data));
        }
      } catch (error) {
        console.error(error);
      }
    };
    if (userId) {
      getTodayAppointment("", "");
    }
  }, [userId]);

  // Helper function to render your sections
  const mappedAppointments = appointmentData.map((item: any) => ({
    name: item.petName,
    owner: item.ownerName,
    image: item.petImage || "/Images/default-pet.png",
    appointmentId: item.tokenNumber,
    reason: item.purposeOfVisit,
    breed: item.breed || "-",
    pet: item.pet,
    time: item.appointmentTime,
    date: item.appointmentDate,
    doctor: item.doctorName,
    specialization: item.departmentName,
    status: item.appointmentStatus,
  }));

  const renderAppointmentSections = () => {
    const sections = [
      {
        title: "Today’s Appointments",
        count: appointmentData.length,
        text: userType === "receptionist" ? `Create Appointment` : "",
        secicon: "solar:calendar-mark-bold",
        href: "/createappointment",
      },
    ];

    return sections.map((section, index) => (
      <Row key={index}>
        <div className="TableItemsRow">
          <HeadingDiv
            Headname={section.title}
            Headspan={section.count}
            btntext={section.text}
            icon={section.secicon}
            href={section.href}
          />
          <EmergencyAppointmentsTable data={mappedAppointments} />
        </div>
      </Row>
    ));
  };

  //emergency appointment 
  const fetchEmergencyAppointments = useCallback(async () => {
  try {
    const response = await getData(`/fhir/v1/getEmergencyAppointment?userId=${userId}`);
    if (response.status === 200) {
      const data: any = response.data;
      const appointments: NormalEmergencyAppointment[] = data.data.map((appt: any) =>
        convertEmergencyAppointmentFromFHIRForTable(appt)
      );
      setEmergencyAppointmentData(appointments);
    }
  } catch (error) {
    console.error("Error fetching emergency appointments:", error);
  }
}, [userId]);

useEffect(() => {
  if (userId) {
    fetchEmergencyAppointments();
  }
}, [fetchEmergencyAppointments, userId]);

const mappedEmergencyAppointments = emergencyAppointmentData.map((item: any) => ({
    name: item.petName,
    owner: item.ownerName,
    appointmentId: item.tokenNumber,
    breed: item.petBreed || "-",
    pet: item.petType,
    time: item.appointmentTime,
    doctor: item.veterinarian,
    specialization: item.departmentName,
    status: item.appointmentStatus,
    gender: item.gender
    
  }));



    const renderEmergencyAppointmentSections = () => {
    const sections = [
      {
        title: "Emergency Appointments",
        count: emergencyAppointmentData.length,
        // text: userType === "receptionist" ? `Create Appointment` : "",
        // secicon: "solar:calendar-mark-bold",
        // href: "/createappointment",
      },
    ];

    return sections.map((section, index) => (
      <Row key={index}>
        <div className="TableItemsRow">
          <HeadingDiv
            Headname={section.title}
            Headspan={section.count}
            // btntext={section.text}
            // icon={section.secicon}
            // href={section.href}
          />
          <EmergencyDataTable data={mappedEmergencyAppointments} />
        </div>
      </Row>
    ));
  };


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
      fetchEmergencyAppointments()
      
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




  const image: any =
    vetAndTeamsProfile?.image ||
    "https://images.unsplash.com/photo-1633332755192-727a05c4013d?q=80&w=880&auto=format&fit=crop";

  return (
    <section className="doctor-dashboard-Sec">
      <Container>
        {!addNewLead ? (
          <div className="DoctorDashboardData">
            <div className="TopDoctorDashboard">
              <div className="LeftDash">
                <Image src={image} alt="" width={80} height={80} />
                <div className="DoctorName">
                  <p>
                    Welcome, Dr.{" "}
                    {`${vetAndTeamsProfile?.name.firstName} ${vetAndTeamsProfile?.name.lastName}`}
                  </p>
                  <h2>Your Dashboard</h2>
                </div>
              </div>
              <div className="RightDash">
                <p>Availability Status</p>
                <div className="custom-toggle-container">
                  <label className="custom-switch">
                    <input
                      type="checkbox"
                      checked={available}
                      onChange={updateAvailability}
                    />
                    <span className="slider" />
                  </label>
                  <span
                    className={`status-text ${available ? "available" : "not-available"}`}
                  >
                    {available ? "Available" : "Not Available"}
                  </span>
                </div>
                {userType === "vet" ? (
                  <Link href="#" onClick={() => setAddNewLead(true)}>
                    <Image
                      src="/Images/stact1.png"
                      alt="stact1"
                      width={24}
                      height={24}
                    />{" "}
                    Manage Appointment Slots
                  </Link>
                ) : (
                  ""
                )}
              </div>
            </div>
            <Row>
              <Col md={3}>
                <StatCard
                  icon="solar:calendar-mark-bold"
                  title="Emergency Appointment"
                  value={158}
                />
              </Col>
              <Col md={3}>
                <StatCard
                  icon="solar:document-medicine-bold"
                  title="Today’s Appointment"
                  value={122}
                />
              </Col>
              <Col md={3}>
                <StatCard
                  icon="solar:clipboard-check-bold"
                  title="Assessments"
                  value={45}
                />
              </Col>
              <Col md={3}>
                <StatCard
                  icon="solar:calendar-add-bold"
                  title="Calender View"
                  value="$7,298"
                />
              </Col>
            </Row>
            {renderEmergencyAppointmentSections()}
            {userType === "receptionist" ? (
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
                errors={errors} // Pass errors state
              />
            ) : (
              ""
            )}
            
            {renderAppointmentSections()}
            <div className="DoctorClender">
              <div className="TopClendr">
                <div className="lftclndr">
                  <h3>
                    My Calendar <span>(14)</span>
                  </h3>
                </div>
                <div className="Rytclndr">
                  <div className="clnderBtn">
                    <Link href="#">
                      <FaCalendar /> View Calendar
                    </Link>
                  </div>
                </div>
              </div>
              <CalendarCard />
            </div>
          </div>
        ) : (
          <DoctorSlots />
        )}
      </Container>
    </section>
  );
}

export default DoctorDashboard;