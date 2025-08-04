import React, { useCallback, useEffect, useState } from "react";
import "./Add_Vet.css";
import { Forminput, FormPassw, HeadText } from "../SignUp/SignUp";
import DOMPurify from "dompurify";
// import camera from '../../../../public/Images/camera.png';
import { ProfileProg } from "../SignUpDetails/SignUpDetails";
import { Col, Form, Nav, Row, Tab } from "react-bootstrap";
// import UplodeImage from '../../Components/UplodeImage/UplodeImage';
import DynamicSelect from "../../Components/DynamicSelect/DynamicSelect";
import OperatingHours from "../../Components/OperatingHours/OperatingHours";
import { Modal, Button } from "react-bootstrap";
import Switch from "react-switch";
// import { MainBtn } from '../Appointment/page';
// import whtcheck from '../../../../public/Images/whtcheck.png';
// import { MdOpacity } from 'react-icons/md';
import axios from "axios";
import DynamicDatePicker from "../../Components/DynamicDatePicker/DynamicDatePicker";
import Swal from "sweetalert2";
import { useNavigate } from "react-router-dom";
import { AiFillFileImage } from "react-icons/ai";
import { BsFileDiffFill } from "react-icons/bs";
import { FaFileWord } from "react-icons/fa";
import { RxCrossCircled } from "react-icons/rx";
import {
  IoIosAddCircle,
  IoIosArrowDropleft,
  IoIosArrowDropright,
} from "react-icons/io";
import { useAuth } from "../../context/useAuth";
import IntlTelInput from "react-intl-tel-input";
import "react-intl-tel-input/dist/main.css";
import { FaCircleCheck } from "react-icons/fa6";
import { MdCloudUpload } from "react-icons/md";

const Add_Vet = () => {
  const { userId, onLogout } = useAuth();
  const navigate = useNavigate();
  const [progress, setProgress] = useState(48);
  const [OperatingHour, setOperatingHours] = useState([]);
  const [uploadedfiles, setUploadedFiles] = useState([]);

  const [PersonalInfoForm, setPersonalInfoForm] = useState({
    firstName: "",
    lastName: "",
    gender: "",
    email: "",
    countrycode: "",
    phone: "",
    dateOfBirth: "",
  });

  const [ResidentialAddressForm, setResidentialAddressForm] = useState({
    addressLine1: "",
    city: "",
    stateProvince: "",
    country: "",
    zipCode: "",
  });
  
  

  // const [selectedFile, setSelectedFile] = useState(null);
  const [consultFee, setConsultFee] = useState("");
  const [CreateLogin, setCreateLogin] = useState({
    username: "",
    password: "",
    confirmPassword: "",
  });
  const [authSettings, setAuthSettings] = useState({
    takeAssessments: false,
    appointments: false,
    viewMedicalRecords: false,
    prescribeMedications: false,
  });
  const [options, setOptions] = useState([]);
  const [timeDuration, setTimeDuration] = useState(null);
  const [image, setImage] = useState(null);
  const [isToggled, setIsToggled] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeModes, setActiveModes] = useState(["In-person"]);
  const [key, setKey] = useState("basic");

  const [previewUrl, setPreviewUrl] = useState("");
  console.log("PersonalInfoForm.lastName.length", PersonalInfoForm.lastName.length);
  useEffect(() => {
    let count = 0;
    const onlyLetters = str => str.replace(/[^a-zA-Z]/g, "");
  
    // Personal Info
    if (onlyLetters(PersonalInfoForm.firstName).length > 1) count++;
    if (onlyLetters(PersonalInfoForm.lastName).length > 1) count++;
    if (PersonalInfoForm.gender) count++;
    if (PersonalInfoForm.email.includes("@")) count++;
    if (PersonalInfoForm.countrycode && PersonalInfoForm.phone.length >= 10) count++;
    if (PersonalInfoForm.dateOfBirth) count++;
  
    // Residential Address
    if (ResidentialAddressForm.addressLine1) count++;
    if (ResidentialAddressForm.city) count++;
    if (ResidentialAddressForm.stateProvince) count++;
    if (ResidentialAddressForm.country) count++;
    if (ResidentialAddressForm.zipCode) count++;
  
    // Professional Background
    if (professionalBackground.specialization) count++;
    if (professionalBackground.qualification) count++;
    if (professionalBackground.medicalLicenseNumber) count++;
    if (professionalBackground.yearsOfExperience) count++;
    if (professionalBackground.languagesSpoken) count++;
    if (professionalBackground.biography) count++;
  
    // Consult Fee
    if (consultFee) count++;
  
    // Create Login
    if (CreateLogin.username) count++;
    if (CreateLogin.password) count++;
    if (CreateLogin.confirmPassword) count++;
  
    // Auth Settings
    if (authSettings.takeAssessments) count++;
    if (authSettings.appointments) count++;
    if (authSettings.viewMedicalRecords) count++;
    if (authSettings.prescribeMedications) count++;
  
    // New: Extra Settings
    if (options.length > 0) count++;
    if (timeDuration !== null) count++;
    if (image !== null) count++;
    if (isToggled) count++;
    if (activeModes.length > 0) count++;
  
    // Total fields = 31
    const totalFields = 31;
    setProgress((count / totalFields) * 100);
  }, [
    PersonalInfoForm,
    ResidentialAddressForm,
    professionalBackground,
    consultFee,
    CreateLogin,
    authSettings,
    options,
    timeDuration,
    image,
    isToggled,
    activeModes,
  ]);
  

  const handleDateChange = (date) => {
    setPersonalInfoForm((pre) => ({
      ...pre,
      dateOfBirth: date,
    }));
  };

  const getSpecilization = useCallback(async () => {
    try {
      const token = sessionStorage.getItem("token");
      const response = await axios.get(
        `${import.meta.env.VITE_BASE_URL}api/auth/getAddDepartment?userId=${userId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const departmentOptions = response.data.map((department) => ({
        value: department._id,
        label: department.departmentName,
      }));
      setOptions(departmentOptions);
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log("Session expired. Redirecting to signin...");
        onLogout(navigate);
      }
    }
  }, [userId, navigate, onLogout]);
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);

    const allowedTypes = [
      "application/pdf", // PDF
      "application/msword", // DOC
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // DOCX
      "image/jpeg", // JPG
      "image/png", // PNG
      "image/gif", // GIF
      "image/webp", // WebP
      "image/bmp", // BMP
    ];

    const validFiles = files.filter((file) => allowedTypes.includes(file.type));

    if (validFiles.length === 0) {
      alert("Only PDF, DOC, DOCX, and image files are allowed!");
      return;
    }

    const filesWithDate = validFiles.map((file) => ({
      name: file.name,
      type: file.type,
      date: new Date().toLocaleDateString("en-GB"),
    }));

    setUploadedFiles((prev) => [...prev, ...filesWithDate]);

    setProfessionalBackground((prev) => ({
      ...prev,
      document: [...prev.document, ...validFiles],
    }));
  };
  const removeFile = (index) => {
    setUploadedFiles((prevFiles) =>
      prevFiles.filter((_, fileIndex) => fileIndex !== index)
    );

    setProfessionalBackground((prev) => ({
      ...prev,
      document: prev.document.filter((_, fileIndex) => fileIndex !== index),
    }));
  };

  useEffect(() => {
    if (userId) getSpecilization();
  }, [userId, getSpecilization]);

  const handleprofessionalBackground = (e) => {
    const { name, value } = e.target;
    setProfessionalBackground((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSpecializationChange = (selectedValue) => {
    setProfessionalBackground((prevState) => ({
      ...prevState,
      specialization: selectedValue,
    }));
  };

  const handleAddressInputChange = (e) => {
    const { name, value } = e.target;
    setResidentialAddressForm((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setPersonalInfoForm((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleClick = (field, value) => {
    setPersonalInfoForm((prevData) => ({
      ...prevData,
      [field]: value,
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
    }
  };

  const handleToggle = (checked) => {
    setIsToggled(checked);
    if (checked) {
      setIsModalOpen(true);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleSaveOperatingHours = (updatedHours) => {
    setOperatingHours(updatedHours);
  };

  // Consultation mode handling

  const handleModeClick = (mode) => {
    if (mode === "Both") {
      setActiveModes(["In-person", "Online"]);
    } else if (
      activeModes.includes("In-person") &&
      activeModes.includes("Online")
    ) {
      setActiveModes([mode]);
    } else {
      setActiveModes([mode]);
    }
  };

  const handleFeeChange = (e) => {
    setConsultFee(e.target.value);
  };


  // Create login handler
  const handleCreateLogin = (e) => {
    const { name, value } = e.target;
    setCreateLogin((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSwitchChange = (e) => {
    const { id, checked } = e.target;
    setAuthSettings((prevSettings) => ({
      ...prevSettings,
      [id]: checked,
    }));
  };

  const handleDynamicChange = (value) => {
    setTimeDuration(value);
  };

  const HandleSubmit = async () => {
    // ✅ 1. Validate input data
    if (
      !PersonalInfoForm.firstName ||
      !PersonalInfoForm.lastName ||
      !PersonalInfoForm.email ||
      !PersonalInfoForm.phone
    ) {
      Swal.fire({
        icon: "error",
        title: "Missing Information",
        text: "Please fill in all required personal information fields.",
      });
      return;
    }

    if (CreateLogin.password !== CreateLogin.confirmPassword) {
      Swal.fire({
        icon: "error",
        title: "Password Mismatch",
        text: "Passwords do not match.",
      });
      return;
    }

    if (!CreateLogin.username) {
      Swal.fire({
        icon: "error",
        title: "Username Required",
        text: "Please provide a username.",
      });
      return;
    }

    const formData = new FormData();

    if (image) {
      formData.append("profilePicture", image);
    }

    if (professionalBackground.cvFile) {
      formData.append("cvFile", professionalBackground.cvFile);
    }

    professionalBackground.document.forEach((file) => {
      formData.append("document", file);
    });

    const timeDurationExtension = {
      url: "http://example.org/fhir/StructureDefinition/timeDuration",
      valueDuration: {
        value: timeDuration,
        unit: "minutes",
        system: "http://unitsofmeasure.org",
        code: "min",
      },
    };

    const mapToFHIRAvailableTime = (operatingHours) => {
      const daysOfWeekMap = {
        Monday: "mon",
        Tuesday: "tue",
        Wednesday: "wed",
        Thursday: "thu",
        Friday: "fri",
        Saturday: "sat",
        Sunday: "sun",
      };

      return operatingHours
        .filter((day) => day.checked) // Only include checked days
        .map((day) => ({
          daysOfWeek: [daysOfWeekMap[day.day]],
          availableStartTime: formatTime(day.times[0].from),
          availableEndTime: formatTime(day.times[0].to),
        }));
    };

    // ⏰ Helper function to format time to HH:mm:ss
    const formatTime = (time) => {
      let hour = parseInt(time.hour);
      if (time.period === "PM" && hour !== 12) hour += 12;
      if (time.period === "AM" && hour === 12) hour = 0;
      return `${String(hour).padStart(2, "0")}:${time.minute}:00`;
    };

    const practitionerResource = {
      resourceType: "Practitioner",
      name: [
        {
          family: PersonalInfoForm.lastName,
          given: [PersonalInfoForm.firstName],
        },
      ],
      telecom: [
        {
          system: "phone",
          value: `${PersonalInfoForm.countrycode}${PersonalInfoForm.phone}`,
          use: "mobile",
        },
        {
          system: "email",
          value: PersonalInfoForm.email,
        },
      ],
      gender: PersonalInfoForm.gender.toLowerCase(),
      birthDate: PersonalInfoForm.dateOfBirth,
      qualification: [
        {
          code: {
            text: professionalBackground.qualification,
          },
          identifier: [
            {
              system: "https://www.medicallicense.com",
              value: professionalBackground.medicalLicenseNumber,
            },
          ],
          period: {
            start: "2020-01-01", // Dummy start date
          },
          issuer: {
            display: "Medical Council",
          },
        },
      ],
      communication: [
        {
          language: {
            text: professionalBackground.languagesSpoken,
          },
        },
      ],
      extension: [
        {
          url: "http://example.org/fhir/StructureDefinition/practitioner-biography",
          valueString: professionalBackground.biography,
        },
        {
          url: "http://example.org/fhir/StructureDefinition/yearsOfExperience",
          valueInteger: parseInt(professionalBackground.yearsOfExperience, 10),
        },
      ],
    };

    const practitionerRoleResource = {
      resourceType: "PractitionerRole",
      practitioner: {
        reference: "Practitioner/1",
      },
      code: [
        {
          coding: [
            {
              system: "http://example.org/fhir/CodeSystem/specialization",
              code: professionalBackground.specialization,
              display: professionalBackground.specialization,
            },
          ],
          text: professionalBackground.specialization,
        },
      ],
      availableTime: mapToFHIRAvailableTime(OperatingHour),
      extension: [
        {
          url: "http://example.org/fhir/StructureDefinition/consultFee",
          valueDecimal: parseFloat(consultFee),
        },
        timeDurationExtension,
        {
          url: "http://example.org/fhir/StructureDefinition/activeModes",
          valueCodeableConcept: activeModes.map((mode) => ({
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/service-mode",
                code: mode.replace(/\s/g, "-").toLowerCase(),
                display: mode,
              },
            ],
          })),
        },
      ],
    };

    const locationResource = {
      resourceType: "Location",
      address: {
        line: [ResidentialAddressForm.addressLine1],
        city: ResidentialAddressForm.city,
        state: ResidentialAddressForm.stateProvince,
        postalCode: ResidentialAddressForm.zipCode,
        country: ResidentialAddressForm.country,
      },
    };

    const basicAuthResource = {
      resourceType: "Basic",
      code: {
        text: "Authentication",
      },
      subject: {
        reference: "Practitioner/1",
      },
      author: {
        display: CreateLogin.username,
      },
      extension: [
        {
          url: "http://example.org/fhir/StructureDefinition/password",
          valueString: CreateLogin.password,
        },
      ],
    };

    const consentResource = {
      resourceType: "Consent",
      status: "active",
      scope: {
        text: "Healthcare Data Access",
      },
      category: [
        {
          text: "Permissions",
        },
      ],
      policy: Object.keys(authSettings).map((key) => ({
        authority: `http://example.org/permissions/${key}`,
        uri: authSettings[key] ? "granted" : "denied",
      })),
    };

    const bundleResource = {
      resourceType: "Bundle",
      type: "transaction",
      identifier: {
        system: "http://example.org/fhir/identifier/userId",
        value: userId,
      },
      entry: [
        // { resource: patientResource },
        { resource: practitionerResource },
        { resource: practitionerRoleResource },
        { resource: locationResource },
        { resource: basicAuthResource },
        { resource: consentResource },
      ],
    };

    formData.append("fhirBundle", JSON.stringify(bundleResource));

    // -------------------------------------------
    // 🚀 4. Submit FormData to Backend
    // -------------------------------------------
    const token = sessionStorage.getItem("token");

    try {
      const response = await fetch(
        `${import.meta.env.VITE_BASE_URL}fhir/v1/Practitioner`,
        {
          method: "POST",
          body: formData,
          headers: {
            Authorization: `Bearer ${token}`, // Attach token for authentication
          },
        }
      );

      if (response.ok) {
        Swal.fire({
          icon: "success",
          title: "Success",
          text: "Doctor added successfully!",
        });
        navigate("/addoctor");
      } else {
        const errorData = await response.json();
        Swal.fire({
          icon: "error",
          title: "Submission Failed",
          text:
            errorData.issue?.[0]?.details?.text ||
            "An error occurred while submitting the form. Please try again.",
        });
      }
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Failed to submit the form. Please try again later.",
      });
      console.error("Submission Error:", error);
    }
  };

  const duration = [
    { value: "15", label: "15 mins" },
    { value: "30", label: "30 mins" },
    { value: "60", label: "1 hour" },
    { value: "120", label: "2 hours" },
  ];

  useEffect(() => {
    if (image && image instanceof File) {
      const url = URL.createObjectURL(image);
      setPreviewUrl(url);

      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setPreviewUrl("");
    }
  }, [image]);

  const sanitizedPreview = previewUrl ? DOMPurify.sanitize(previewUrl) : "";

  return (
    <section className="ProfileSec">
      <div className="container">
        <div className="mb-3">
          <HeadText Spntext="Add" blktext="a vet " />
        </div>

        <div className="AddVetTabDiv">
          <Tab.Container activeKey={key} onSelect={(k) => setKey(k)}>
            <div className="Add_Profile_Data">
              <div>
                <Nav variant="pills" className=" VetPills">
                  <Nav.Item>
                    <Nav.Link eventKey="basic">
                      <span>1</span> Basic Information
                    </Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link eventKey="professional">
                      <span>2</span> Professional Details
                    </Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link eventKey="availability">
                      <span>3</span> Availability & Consultation
                    </Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link eventKey="login">
                      <span>4</span> Login & Permissions
                    </Nav.Link>
                  </Nav.Item>
                </Nav>
              </div>
              <div></div>
            </div>

            <div className="Add_Profile_Data">
              <div className="LeftProfileDiv">
                <Tab.Content>
                  {/* Basic Information */}
                  <Tab.Pane eventKey="basic">
                    <Form className="BasicForm">
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
                                <img
                                  src={sanitizedPreview}
                                  alt="Preview"
                                  className="preview-image"
                                />
                              ) : (
                                <div className="upload-placeholder">
                                  <img
                                    src={`${import.meta.env.VITE_BASE_IMAGE_URL}/camera.png`}
                                    alt="camera"
                                    className="icon"
                                  />
                                </div>
                              )}
                            </label>
                            <h5>Add Profile Picture</h5>
                          </div>
                        </div>
                        <Row>
                          <Col md={6}>
                            <Forminput
                              inlabel="First Name"
                              intype="text"
                              inname="firstName"
                              value={PersonalInfoForm.firstName}
                              onChange={handleInputChange}
                            />
                          </Col>
                          <Col md={6}>
                            <Forminput
                              inlabel="Last Name"
                              intype="text"
                              inname="lastName"
                              value={PersonalInfoForm.lastName}
                              onChange={handleInputChange}
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
                                      PersonalInfoForm.gender === gender
                                        ? "active"
                                        : ""
                                    }
                                    onClick={() =>
                                      handleClick("gender", gender)
                                    }
                                  >
                                    {gender}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </Col>
                          <Col md={6}>
                            <DynamicDatePicker
                              onDateChange={handleDateChange} // Pass the handler function
                              placeholder="Date of Birth"
                              maxDate={Date.now()}
                            />
                          </Col>
                        </Row>
                        <Row>
                          <Col md={12}>
                            <Forminput
                              inlabel="Email Address"
                              intype="email"
                              inname="email"
                              value={PersonalInfoForm.email}
                              onChange={handleInputChange}
                            />
                          </Col>
                        </Row>
                        <Row>
                          <Col md={3}>
                            <div className="InputCountry">
                              <IntlTelInput
                                preferredCountries={["in", "us"]}
                                defaultCountry="in"
                                separateDialCode={true}
                                containerClassName="intl-tel-input"
                                inputClassName="form-control"
                                value={PersonalInfoForm.phone} // Keep phone value unchanged
                                onPhoneNumberBlur={(
                                  isValid,
                                  value,
                                  countryData
                                ) => {
                                  // Update only the country code
                                  setPersonalInfoForm((pre) => ({
                                    ...pre,
                                    countrycode: `+${countryData.dialCode}`, // Update country code only
                                  }));
                                }}
                              />

                              {/* <input
                                type="text"
                                className="form-control"
                                placeholder="Search country code..."
                                value={searchTerms}
                                onChange={(e) => setSearchTerms(e.target.value)}
                              />
                              <select
                                className="form-control"
                                value={PersonalInfoForm.countrycode}
                                onChange={(e) =>
                                  setPersonalInfoForm((pre) => ({
                                    ...pre,
                                    countrycode: e.target.value,
                                  }))
                                }
                              >
                                {filteredCountries.map((country, index) => (
                                  <option key={index} value={country.countryCode}>
                                    {country.emoji} {country.countryCode}
                                  </option>
                                ))}
                              </select> */}
                            </div>
                          </Col>
                          <Col md={9}>
                            <Forminput
                              inlabel="Phone Number"
                              intype="number"
                              inname="phone"
                              value={PersonalInfoForm.phone}
                              onChange={handleInputChange}
                            />
                          </Col>
                        </Row>
                      </div>

                      <div className="doctadressdiv">
                        <h6>Residential Address</h6>
                        <Row>
                          <Col md={12}>
                            <Forminput
                              inlabel="Address Line 1"
                              intype="text"
                              inname="addressLine1"
                              value={ResidentialAddressForm.addressLine1}
                              onChange={handleAddressInputChange}
                            />
                          </Col>
                        </Row>
                        <Row>
                          <Col md={6}>
                            <Forminput
                              inlabel="City"
                              intype="text"
                              inname="city"
                              value={ResidentialAddressForm.city}
                              onChange={handleAddressInputChange}
                            />
                          </Col>
                          <Col md={6}>
                            <Forminput
                              inlabel="State / Province"
                              intype="text"
                              inname="stateProvince"
                              value={ResidentialAddressForm.stateProvince}
                              onChange={handleAddressInputChange}
                            />
                          </Col>
                        </Row>
                        <Row>
                          <Col md={6}>
                            <Forminput
                              inlabel="Country"
                              intype="text"
                              inname="country"
                              value={ResidentialAddressForm.country}
                              onChange={handleAddressInputChange}
                            />
                          </Col>
                          <Col md={6}>
                            <Forminput
                              inlabel="ZIP Code"
                              intype="number"
                              inname="zipCode"
                              value={ResidentialAddressForm.zipCode}
                              onChange={handleAddressInputChange}
                            />
                          </Col>
                        </Row>
                      </div>

                      <div className="TabsBtn">
                        <Button onClick={() => setKey("professional")}>
                          Next <IoIosArrowDropright />
                        </Button>
                      </div>
                    </Form>
                  </Tab.Pane>

                  {/* Professional Details */}
                  <Tab.Pane eventKey="professional">
                    <Form className="ProfesForm">
                      <div className="ProfBackDiv">
                        <h6>Professional Background</h6>

                        <Row>
                          <Col md={12}>
                            <DynamicSelect
                              options={options} // Pass options here
                              placeholder="Specialization" // Placeholder text
                              value={professionalBackground.specialization} // Use just the value
                              onChange={(selectedValue) =>
                                handleSpecializationChange(selectedValue)
                              } // Handle selection change
                            />
                          </Col>
                        </Row>

                        <Row>
                          <Col md={12}>
                            <Forminput
                              inlabel="Qualification (MBBS, MD, etc.)"
                              intype="text"
                              inname="qualification"
                              value={professionalBackground.qualification}
                              onChange={handleprofessionalBackground}
                            />
                          </Col>
                        </Row>

                        <Row>
                          <Col md={6}>
                            <Forminput
                              inlabel="Medical License Number"
                              intype="number"
                              inname="medicalLicenseNumber"
                              value={
                                professionalBackground.medicalLicenseNumber
                              }
                              onChange={handleprofessionalBackground}
                            />
                          </Col>
                          <Col md={6}>
                            <Forminput
                              inlabel="Years of Experience"
                              intype="number"
                              inname="yearsOfExperience"
                              value={professionalBackground.yearsOfExperience}
                              onChange={handleprofessionalBackground}
                            />
                          </Col>
                        </Row>

                        <Row>
                          <Col md={12}>
                            <Forminput
                              inlabel="Languages spoken"
                              intype="text"
                              inname="languagesSpoken"
                              value={professionalBackground.languagesSpoken}
                              onChange={handleprofessionalBackground}
                            />
                          </Col>
                        </Row>

                        <Row>
                          <Col md={12}>
                            <div className="form-floating  mb-3">
                              <textarea
                                className="form-control"
                                placeholder="Biography/Short Description"
                                id="floatingTextarea2"
                                value={professionalBackground.biography}
                                onChange={(e) =>
                                  setProfessionalBackground({
                                    ...professionalBackground,
                                    biography: e.target.value,
                                  })
                                }
                              ></textarea>
                              <label htmlFor="floatingTextarea2">
                                Biography/Short Description
                              </label>
                            </div>
                          </Col>
                        </Row>

                        <Row>
                          <Col md={12}>
                            <Form.Group
                              controlId="formFile"
                              className="CvUplodeDiv"
                            >
                              <Form.Control
                                type="file"
                                onChange={(e) => {
                                  const file = e.target.files[0];
                                  if (file) {
                                    setProfessionalBackground({
                                      ...professionalBackground,
                                      cvFile: file, // Store the file object, not the value
                                    });
                                  }
                                }}
                              />
                              <div className="CvLabel">
                                <p>
                                  {professionalBackground.cvFile
                                    ? professionalBackground.cvFile.name
                                    : "Upload CV / Resume (optional)"}
                                </p>
                                <MdCloudUpload />
                              </div>
                            </Form.Group>
                          </Col>
                        </Row>

                        {/* <UplodeImage onFileChange={handleFileChange} /> */}

                        <div className="DoctProfpdf">
                          <h5>Uploaded Documents</h5>
                          <div className="PdfUpldpf">
                            <div className="uploaded_files">
                              {uploadedfiles?.map((file, index) => (
                                <div key={index} className="file-item">
                                  {/* Display icons based on file type */}
                                  {file.type.startsWith("image/") ? (
                                    <AiFillFileImage />
                                  ) : file.type === "application/pdf" ? (
                                    <BsFileDiffFill />
                                  ) : (
                                    <FaFileWord /> // Icon for DOC/DOCX files
                                  )}
                                  <div className="pdfnme">
                                    <span>
                                      {file.name.length > 15
                                        ? `${file.name.substring(0, 12)}...`
                                        : file.name}
                                    </span>
                                    <span className="file-date">
                                      {file.date}
                                    </span>
                                  </div>
                                  <button onClick={() => removeFile(index)}>
                                    <RxCrossCircled />
                                  </button>
                                </div>
                              ))}
                            </div>

                            <div className="pdfUpldeButton">
                              <label
                                htmlFor="file-upload"
                                className="upload-btn"
                              >
                                <IoIosAddCircle /> Upload
                              </label>
                              <input
                                type="file"
                                id="file-upload"
                                accept=".pdf,.doc,.docx,image/*" // Allow PDF, DOC, DOCX, and images
                                multiple
                                onChange={handleFileChange}
                                style={{ display: "none" }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* {selectedFile && (
                            <div>
                              <h3>Selected File:</h3>
                              <p>File Name: {selectedFile.name}</p>
                              <p>File Type: {selectedFile.type}</p>
                              <p>File Size: {selectedFile.size} bytes</p>
                            </div>
                          )} */}
                      </div>

                      <div className="ProfBtn">
                        <Button className="Hov" onClick={() => setKey("basic")}>
                          <IoIosArrowDropleft /> Back
                        </Button>
                        <Button onClick={() => setKey("availability")}>
                          Next <IoIosArrowDropright />
                        </Button>
                      </div>
                    </Form>
                  </Tab.Pane>

                  {/* Availability & Consultation */}
                  <Tab.Pane eventKey="availability">
                    <Form className="availbiltyForm">
                      <div className="abilityDiv">
                        <h3>Availability</h3>

                        <div className="SetApontDiv">
                          <div className="lftapt">
                            <h5>Set Appointment Duration</h5>
                            <p>Set the default time for appointments.</p>
                          </div>
                          <div className="Rytapt">
                            <DynamicSelect
                              options={duration} // Pass the options here
                              placeholder="15 min" // Set the placeholder
                              onChange={handleDynamicChange}
                            />
                          </div>
                        </div>

                        <OperatingHours
                          onSave={handleSaveOperatingHours}
                          Optrtname="Availability"
                        />

                        <div className="SynclndrDiv">
                          <p>Sync with Calendar</p>
                          <div className="text-center ">
                            <div className="d-flex align-items-center justify-content-center gap-2">
                              <span>{isToggled ? "On" : "Off"}</span>
                              <Switch
                                checked={isToggled}
                                onChange={handleToggle}
                                onColor="#86d3ff"
                                onHandleColor="#2693e6"
                                handleDiameter={20}
                                uncheckedIcon={false}
                                checkedIcon={false}
                                boxShadow="0px 1px 5px rgba(0, 0, 0, 0.6)"
                                activeBoxShadow="0px 0px 1px 10px rgba(0, 0, 0, 0.2)"
                                height={20}
                                width={48}
                              />
                            </div>

                            {/* Modal */}
                            <Modal show={isModalOpen} onHide={closeModal}>
                              <Modal.Header closeButton>
                                <Modal.Title>Toggle is On</Modal.Title>
                              </Modal.Header>
                              <Modal.Body>
                                <p>
                                  The toggle is turned on. You can add more
                                  content here.
                                </p>
                              </Modal.Body>
                              <Modal.Footer>
                                <Button
                                  variant="secondary"
                                  onClick={closeModal}
                                >
                                  Close
                                </Button>
                              </Modal.Footer>
                            </Modal>
                          </div>
                        </div>

                        <div className="ConsultationModeDiv">
                          <p>Consultation Mode</p>
                          <div className="ConstModeUl">
                            <ul>
                              <li
                                className={
                                  activeModes.includes("In-person")
                                    ? "active"
                                    : ""
                                }
                                onClick={() => handleModeClick("In-person")}
                              >
                                In-person
                              </li>
                              <li
                                className={
                                  activeModes.includes("Online") ? "active" : ""
                                }
                                onClick={() => handleModeClick("Online")}
                              >
                                Online
                              </li>
                              <li
                                className={
                                  activeModes.includes("In-person") &&
                                  activeModes.includes("Online")
                                    ? "active"
                                    : ""
                                }
                                onClick={() => handleModeClick("Both")}
                              >
                                Both
                              </li>
                            </ul>
                          </div>
                        </div>

                        <Row>
                          <Col md={6}>
                            <div className="ConsultFee">
                              <p>Consultation Fee</p>
                              <Forminput
                                inlabel="$ Fee"
                                intype="number"
                                inname="number"
                                value={consultFee}
                                onChange={handleFeeChange}
                              />
                            </div>
                          </Col>
                        </Row>
                      </div>

                      <div className="ProfBtn">
                        <Button
                          className="Hov"
                          onClick={() => setKey("professional")}
                        >
                          <IoIosArrowDropleft /> Back
                        </Button>
                        <Button onClick={() => setKey("login")}>
                          Next <IoIosArrowDropright />
                        </Button>
                      </div>
                    </Form>
                  </Tab.Pane>

                  {/* Login & Permissions */}
                  <Tab.Pane eventKey="login">
                    <Form className="availbiltyForm">
                      <div className="crtlogn">
                        <h6>Create Login</h6>

                        {/* Form for username */}
                        <Forminput
                          inlabel="Choose username"
                          intype="text"
                          inname="username"
                          value={CreateLogin.username}
                          onChange={handleCreateLogin}
                        />

                        {/* Form for password */}
                        <FormPassw
                          paswlabel="Password"
                          intype="password"
                          inname="password"
                          value={CreateLogin.password}
                          onChange={handleCreateLogin}
                        />

                        <FormPassw
                          paswlabel="Confirm Password"
                          intype="password"
                          inname="confirmPassword"
                          value={CreateLogin.confirmPassword}
                          onChange={handleCreateLogin}
                        />

                        {/* Display error message */}
                      </div>
                      <div className="AuthrizDiv">
                        <h6>Authorization Settings</h6>
                        <div className="AuthrzData">
                          {/* Take Assessments */}
                          <div className="Authitems">
                            <div className="lftauth">
                              <h6>Take Assessments</h6>
                              <p>
                                Allow this vet to conduct assessments for pets.
                              </p>
                            </div>
                            <div className="Ryttauth">
                              <p>On</p>
                              <Form.Check
                                type="switch"
                                id="takeAssessments"
                                checked={authSettings.takeAssessments}
                                onChange={handleSwitchChange}
                              />
                              <p>Off</p>
                            </div>
                          </div>

                          {/* Appointments (Chat or In-Person) */}
                          <div className="Authitems">
                            <div className="lftauth">
                              <h6>Appointments (Chat or In-Person)</h6>
                              <p>
                                Authorize this vet to handle chat or in-person
                                appointments.
                              </p>
                            </div>
                            <div className="Ryttauth">
                              <p>On</p>
                              <Form.Check
                                type="switch"
                                id="appointments"
                                checked={authSettings.appointments}
                                onChange={handleSwitchChange}
                              />
                              <p>Off</p>
                            </div>
                          </div>

                          {/* View Medical Records */}
                          <div className="Authitems">
                            <div className="lftauth">
                              <h6>View Medical Records</h6>
                              <p>
                                Grant access to the pet’s medical history and
                                records.
                              </p>
                            </div>
                            <div className="Ryttauth">
                              <p>On</p>
                              <Form.Check
                                type="switch"
                                id="viewMedicalRecords"
                                checked={authSettings.viewMedicalRecords}
                                onChange={handleSwitchChange}
                              />
                              <p>Off</p>
                            </div>
                          </div>

                          {/* Prescribe Medications */}
                          <div className="Authitems">
                            <div className="lftauth">
                              <h6>Prescribe Medications</h6>
                              <p>
                                Allow the vet to issue prescriptions for
                                treatments.
                              </p>
                            </div>
                            <div className="Ryttauth">
                              <p>On</p>
                              <Form.Check
                                type="switch"
                                id="prescribeMedications"
                                checked={authSettings.prescribeMedications}
                                onChange={handleSwitchChange}
                              />
                              <p>Off</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="Sign_check">
                        <input
                          type="checkbox"
                          className="check-input"
                          id="exampleCheck1"
                          required
                        />
                        <label
                          className="form-check-label"
                          htmlFor="exampleCheck1"
                        >
                          I agree to Yosemite Crew’s{" "}
                          <span>Terms and Conditions</span> and{" "}
                          <span>Privacy Policy</span>
                        </label>
                      </div>

                      <div className="ProfBtn">
                        <Button
                          variant="secondary"
                          onClick={() => setKey("availability")}
                        >
                          <IoIosArrowDropleft /> Back
                        </Button>
                        <Button
                          onClick={() => {
                            HandleSubmit();
                          }}
                        >
                          {" "}
                          <FaCircleCheck /> Add Vet
                        </Button>
                        {/* <MainBtn
                          btntyp="button"
                          bimg={`${import.meta.env.VITE_BASE_IMAGE_URL}/whtcheck.png`}
                          btext="Add Vet"
                          onClick={() => {
                            HandleSubmit();
                          }}
                        /> */}
                      </div>
                    </Form>
                  </Tab.Pane>
                </Tab.Content>
              </div>

              <div className="RytProfileDiv">
                <ProfileProg
                  blname="Profile"
                  spname="Progress"
                  progres={progress}
                />
              </div>
            </div>
          </Tab.Container>
        </div>
      </div>
    </section>
  );
};

export default Add_Vet;
