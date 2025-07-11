"use client";
import React, { useState, useEffect, useCallback } from "react";
import "./AddVetProfile.css";
import { Button, Col, Container, FloatingLabel, Form, Nav, Row, Tab } from "react-bootstrap";
import { HeadText } from "../CompleteProfile/CompleteProfile";
import { RiShieldUserFill } from "react-icons/ri";
import { FaCalendar, FaCircleCheck, FaSuitcaseRolling } from "react-icons/fa6";
import { IoIosArrowDropleft, IoIosArrowDropright } from "react-icons/io";
import ProfileProgressbar from "@/app/Components/ProfileProgressbar/ProfileProgressbar";
import Image from "next/image";
import { FormInput } from "../Sign/SignUp";
import DynamicDatePicker from "@/app/Components/DynamicDatePicker/DynamicDatePicker";
import { PhoneInput } from "@/app/Components/PhoneInput/PhoneInput";
import DynamicSelect from "@/app/Components/DynamicSelect/DynamicSelect";
import UploadImage from "@/app/Components/UploadImage/UploadImage";
import OperatingHours from "@/app/Components/OperatingHours/OperatingHours";
import {  convertToFhirVetProfile } from "@yosemite-crew/fhir";
import { OperatingHourType } from "@yosemite-crew/types"
import { postData } from "@/app/axios-services/services";
import Swal from "sweetalert2";
import { useAuthStore } from "@/app/stores/authStore";


function AddVetProfile() {
  // const {userId} = useAuth()
  const { userId, email, userType } = useAuthStore();

  useEffect(() => {
    console.log("user", userId, email, userType);
  }, [userId, email, userType]);
  const [area, setArea] = useState<string>(''); //Set country
  const [progress] = useState(48); // Progressbar cound
  const [key, setKey] = useState("profileInfo");
  // Add state for phone and country code
  const [countryCode, setCountryCode] = useState("+91");

  // add specialization options
  const [specialization, setSpecialization] = useState<string>("");
   const [duration, setDuration] = useState<string>(''); // Set duration for consultation
  const [image, setImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [OperatingHour, setOperatingHours] = useState<OperatingHourType[]>([]);
  const sanitizedPreview = previewUrl;
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [name, setName] = useState({
    registrationNumber: "",
    firstName: "",
    lastName: "",
    email: "",
    mobileNumber: "",
    gender: "",
    dateOfBirth: "",
    linkedin: "",
    medicalLicenseNumber: "",
    yearsOfExperience: "",
    postalCode: "",
    addressLine1: "",
    city: "",
    stateProvince: "",
    biography: "",

  });
  console.log("name", name);
  const handleBusinessInformation = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = e.target;
    setName((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleGenderClick = (gender: string) => {
    setName((prevData) => ({
      ...prevData,
      gender,
    }));
  };
  // Input Feild Ended

  // Use this handler for date picker:
  const handleDateChange = (date: string | null) => {
    setName((prevData) => ({
      ...prevData,
      dateOfBirth: date || "",
    }));
  };

  // Profile Picture Started
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
    }
  };
  const formData = new FormData();
  if (image) {
    formData.append("profilePicture", image);
  }
  useEffect(() => {
    if (image) {
      const url = URL.createObjectURL(image);
      setPreviewUrl(url);

      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setPreviewUrl("");
    }
  }, [image]);
  // Profile Picture Ended

  type Option = {
    value: string;
    label: string;
  };



  //Specialization Options
  const specializationOptions: Option[] = [
    { value: 'cardiology', label: '🫀 Cardiology' },
    { value: 'orthopedics', label: '🦴 Orthopedics' },
    { value: 'dermatology', label: '🧴 Dermatology' },
    { value: 'pediatrics', label: '🧒 Pediatrics' },
    { value: 'neurology', label: '🧠 Neurology' },
    { value: 'radiology', label: '🖼️ Radiology' },
    { value: 'dentistry', label: '🦷 Dentistry' },
    { value: 'psychiatry', label: '🧘 Psychiatry' },
  ];
  //Area Options
  const areaOptions: Option[] = [
    { value: 'north', label: '⬆️ North Zone' },
    { value: 'south', label: '⬇️ South Zone' },
    { value: 'east', label: '➡️ East Zone' },
    { value: 'west', label: '⬅️ West Zone' },
    { value: 'central', label: '🧭 Central Zone' },
    { value: 'urban', label: '🏙️ Urban Area' },
    { value: 'rural', label: '🌾 Rural Area' },
    { value: 'coastal', label: '🏖️ Coastal Area' },
  ];

  const handleSaveOperatingHours = (updatedHours: React.SetStateAction<OperatingHourType[]>) => {
    setOperatingHours(updatedHours);
  };
 
   // Handle Duration Change
  const handleDurationChange = (value: React.SetStateAction<string>) => {
    setDuration(value)
  }
  const handleSubmit = useCallback(async () => {
  try {
    console.log("Submitting form with data:", )
    const response = convertToFhirVetProfile({
      name,
      image,
      countryCode,
      OperatingHour,
      specialization,
      uploadedFiles,
      duration,
    });

    const formdata = new FormData();
formdata.append("data", JSON.stringify(response));

if (image) {
  formdata.append("image", image);
}

uploadedFiles.forEach((file) => {
  formdata.append("document[]", file);
});

    const data = await postData(`/fhir/v1/Practitioner?userId=${userId}`, formdata,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );

    if (data.status === 201) {
      Swal.fire({
        icon: "success",
        title: "Success",
        text: "Doctor added successfully!",
      });
    }
    //  else {
    // //   const errorData = await data.json();
    //   Swal.fire({
    //     icon: "error",
    //     title: "Submission Failed",
    //     text:
    //       errorData.issue?.[0]?.details?.text ||
    //       "An error occurred while submitting the form. Please try again.",
    //   });
    // }
  } catch (error) {
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "Failed to submit the form. Please try again later.",
    });
    console.error("Submission Error:", error);
  }
}, [OperatingHour, countryCode, name, image, specialization, uploadedFiles, duration]);


  return (
    <>
      <section className="CompltProfileSec">
        <Container>
          <div className="mb-3">
            <HeadText blktext="Complete" Spntext="your profile" />
          </div>

          <div className="AddVetTabDiv">
            <Tab.Container
              activeKey={key}
              onSelect={(k) => setKey(k as string)}
            >
              <div className="Add_Profile_Data">
                <div>
                  <Nav variant="pills" className=" VetPills">
                    <Nav.Item>
                      <Nav.Link eventKey="profileInfo">
                        <span>
                          <RiShieldUserFill />
                        </span>{" "}
                        Personal Information
                      </Nav.Link>
                    </Nav.Item>

                    <Nav.Item>
                      <Nav.Link eventKey="ProfDetails">
                        <span>
                          <FaSuitcaseRolling />
                        </span>{" "}
                        Professional Details
                      </Nav.Link>
                    </Nav.Item>

                    <Nav.Item>
                      <Nav.Link eventKey="AvaillConst">
                        <span>
                          <FaCalendar />
                        </span>{" "}
                        Availability & Consultation
                      </Nav.Link>
                    </Nav.Item>
                  </Nav>
                </div>
                <div></div>
              </div>

              <div className="Add_Profile_Data">
                <div className="LeftProfileDiv">
                  <Tab.Content>
                    {/* Profile Information */}
                    <Tab.Pane eventKey="profileInfo">
                      <Form className="PersonalInfoData">
                        <div className="PersonlInfoDiv">
                          <div className="perInfo">
                            <h6>Personal Information</h6>
                            <div className="add-logo-container">
                              <input
                                type="file"
                                id="logo-upload"
                                accept="image/*"
                                onChange={handleImageChange}
                                style={{ display: "none" }}
                              />
                              <label
                                htmlFor="logo-upload"
                                className="upload-label"
                              >
                                {image && sanitizedPreview ? (
                                  <Image
                                    src={sanitizedPreview}
                                    alt="Preview"
                                    className="preview-image"
                                    width={40}
                                    height={40}
                                  />
                                ) : (
                                  <div className="upload-placeholder">
                                    <Image
                                      src="/Images/camera.png"
                                      alt="camera"
                                      className="icon"
                                      width={40}
                                      height={40}
                                    />
                                  </div>
                                )}
                              </label>
                              <h5>Add Profile Picture</h5>
                            </div>
                          </div>
                          <Row>
                            <Col md={12}>
                              <FormInput
                                intype="number"
                                inname="registrationNumber"
                                value={name.registrationNumber}
                                inlabel="Business Registration Number/PIMS ID"
                                onChange={handleBusinessInformation}
                              />
                            </Col>
                          </Row>
                          <Row>
                            <Col md={6}>
                              <FormInput
                                intype="text"
                                inname="firstName"
                                value={name.firstName}
                                inlabel="First Name"
                                onChange={handleBusinessInformation}
                              />
                            </Col>
                            <Col md={6}>
                              <FormInput
                                intype="text"
                                inname="lastName"
                                value={name.lastName}
                                inlabel="Last Name"
                                onChange={handleBusinessInformation}
                              />
                            </Col>
                          </Row>
                          <Row>
                            <Col md={6}>
                              <div className="DoctGendr">
                                <p>Gender</p>
                                <ul className="SelectUl">
                                  {["Male", "Female", "Other"].map((gender) => (
                                    <li
                                      key={gender}
                                      className={
                                        name.gender === gender ? "active" : ""
                                      }
                                      onClick={() => handleGenderClick(gender)}
                                    >
                                      {gender}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </Col>
                            <Col md={6}>
                              <DynamicDatePicker
                                placeholder="Date of Birth"
                                value={name.dateOfBirth}
                                onDateChange={handleDateChange}
                              />
                            </Col>
                          </Row>
                          <Row>
                            <Col md={12}>
                              <FormInput
                                intype="email"
                                inname="email"
                                value={name.email}
                                inlabel="Enter Email"
                                onChange={handleBusinessInformation}
                              />
                            </Col>
                          </Row>
                          <Row>
                            <Col md={12}>
                              <PhoneInput
                                countryCode={countryCode}
                                onCountryCodeChange={setCountryCode}
                                phone={name.mobileNumber}
                                onPhoneChange={(value) => setName({ ...name, mobileNumber: value })}
                              />
                            </Col>
                          </Row>
                        </div>
                        <div className="DivideLine"></div>

                        <div className="doctadressdiv">
                          <h6>Residential Address</h6>
                          <Row>
                            <Col md={6}>
                              <FormInput
                                intype="number"
                                inname="postalCode"
                                value={name.postalCode}
                                inlabel="Postal Code"
                                onChange={handleBusinessInformation}
                              />
                            </Col>
                            <Col md={6}>
                              <DynamicSelect options={areaOptions} value={area} onChange={setArea} inname="area" placeholder="Area" />
                            </Col>
                          </Row>
                          <Row>
                            <Col md={12}>
                              <FormInput
                                intype="text"
                                inname="addressLine1"
                                value={name.addressLine1}
                                inlabel="AddressLine1"
                                onChange={handleBusinessInformation}
                              />
                            </Col>
                          </Row>
                          <Row>
                            <Col md={6}>
                              <FormInput
                                intype="text"
                                inname="city"
                                value={name.city}
                                inlabel="City"
                                onChange={handleBusinessInformation}
                              />
                            </Col>
                            <Col md={6}>
                              <FormInput
                                intype="text"
                                inname="stateProvince"
                                value={name.stateProvince}
                                inlabel="State/Province"
                                onChange={handleBusinessInformation}
                              />
                            </Col>
                          </Row>
                        </div>

                        <div className="ComptBtn">
                          <Button onClick={() => setKey("ProfDetails")}>
                            Next <IoIosArrowDropright />
                          </Button>
                        </div>
                      </Form>
                    </Tab.Pane>

                    {/* ProfDetails Details */}
                    <Tab.Pane eventKey="ProfDetails">
                      <Form className="ProfileDetailsData">
                        <h6>Professional Details</h6>

                        <Row>
                          <Col md={12}>
                            <FormInput
                              intype="text"
                              inname="linkedin"
                              value={name.linkedin}
                              inlabel="LinkedIn Link"
                              onChange={handleBusinessInformation}
                            />
                          </Col>
                        </Row>
                        <Row>
                          <Col md={6}>
                            <FormInput
                              intype="number"
                              inname="medicalLicenseNumber"
                              value={name.medicalLicenseNumber}
                              inlabel="Medical License Number"
                              onChange={handleBusinessInformation}
                            />
                          </Col>
                          <Col md={6}>
                            <FormInput
                              intype="number"
                              inname="yearsOfExperience"
                              value={name.yearsOfExperience}
                              inlabel="Years of Experience"
                              onChange={handleBusinessInformation}
                            />
                          </Col>
                        </Row>
                        <Row>
                          <Col md={12}>
                            <DynamicSelect options={specializationOptions} value={specialization} onChange={setSpecialization} inname="Specialisation" placeholder="Specialisation" />
                          </Col>
                        </Row>
                        <Row>
                          <Col md={12}>
                            <div className="FormTexediv">
                              <FloatingLabel className="textarealabl" controlId="floatingTextarea2" label="Biography/Short Description">
                                <Form.Control
                                  as="textarea"
                                  placeholder="Leave a comment here"
                                  style={{ height: '100px' }}
                                  onChange={(e) => setName({ ...name, biography: e.target.value })}
                                />
                              </FloatingLabel>
                            </div>
                          </Col>
                        </Row>
                        <Row>
                          <Col md={12}>
                            <UploadImage onChange={(files) => setUploadedFiles(files)} />
                          </Col>
                        </Row>

                        <div className="ComptBtn twbtn">
                          <Button
                            className="Hov"
                            onClick={() => setKey("profileInfo")}
                          >
                            <IoIosArrowDropleft /> Back
                          </Button>
                          <Button onClick={() => setKey("AvaillConst")}>
                            Next <IoIosArrowDropright />
                          </Button>
                        </div>
                      </Form>
                    </Tab.Pane>

                    {/* service & Consultation */}
                    <Tab.Pane eventKey="AvaillConst">
                      <Form className="ServiceData">
                        <OperatingHours
                          onSave={handleSaveOperatingHours}
                          Optrtname="Availability"
                          onChange={handleDurationChange}
                        />
                        <div className="ComptBtn twbtn">
                          <Button
                            className="Hov"
                            onClick={() => setKey("ProfDetails")}
                          >
                            <IoIosArrowDropleft /> Back
                          </Button>
                          <Button onClick={handleSubmit}>
                            <FaCircleCheck />
                            Finish
                          </Button>
                        </div>
                      </Form>
                    </Tab.Pane>
                  </Tab.Content>
                </div>

                <div className="RytProfileDiv">
                  <ProfileProgressbar
                    blname="Profile"
                    spname="Progress"
                    progres={progress}
                  />
                </div>
              </div>
            </Tab.Container>
          </div>

        </Container>
      </section>
    </>
  );
}

export default AddVetProfile;
