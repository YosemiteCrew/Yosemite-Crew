"use client";
import React, { useState, useEffect, useCallback } from "react";
import "./AddVetProfile.css";
import {
  Button,
  Col,
  Container,
  FloatingLabel,
  Form,
  Nav,
  Row,
  Tab,
} from "react-bootstrap";
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
import OperatingHours, {
  DayHours,
} from "@/app/Components/OperatingHours/OperatingHours";
import { convertToFhirVetProfile } from "@yosemite-crew/fhir";
import { postData } from "@/app/axios-services/services";
import Swal from "sweetalert2";
import { useAuthStore } from "@/app/stores/authStore";
import { useRouter } from "next/navigation";

function AddVetProfile() {
  const router = useRouter();
  const {
    userId,
    email,
    userType,
    vetAndTeamsProfile,
    fetchVetAndTeamsProfile,
  } = useAuthStore();

  const [area, setArea] = useState<string>("");
  const [progress, setProgress] = useState(33);
  const [key, setKey] = useState("profileInfo");
  const [countryCode, setCountryCode] = useState("+91");
  const [specialization, setSpecialization] = useState<string>("");
  const [qualification, setQualification] = useState<string>("");
  const [duration, setDuration] = useState<string>("");
  const [image, setImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [OperatingHour, setOperatingHours] = useState<DayHours[]>([]);
  const sanitizedPreview = previewUrl;
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [apiFiles, setApiFiles] = useState<[]>([]);

  useEffect(() => {
    const filesFromApi = vetAndTeamsProfile?.uploadedFiles || [];
    const transformed: any[] = filesFromApi.map((f: any) => ({
      name: f.name.split("/").pop(),
      type: f.type,
      url: f.name,
    }));
    setApiFiles(transformed as []);
    setUploadedFiles([]);
  }, [vetAndTeamsProfile]);

  type ErrorType = {
    [key: string]: string;
  };
  const [errors, setErrors] = useState<ErrorType>({});

  const [name, setName] = useState({
    rcvsNumber: "",
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

  useEffect(() => {
    setName({
      rcvsNumber: vetAndTeamsProfile?.name.rcvsNumber || "",
      firstName: vetAndTeamsProfile?.name.firstName || "",
      lastName: vetAndTeamsProfile?.name?.lastName || "",
      email: vetAndTeamsProfile?.name.email || "",
      mobileNumber: vetAndTeamsProfile?.name.mobileNumber || "",
      gender: vetAndTeamsProfile?.name.gender || "",
      dateOfBirth: vetAndTeamsProfile?.name.dateOfBirth || "",
      linkedin: vetAndTeamsProfile?.name.linkedin || "",
      medicalLicenseNumber: vetAndTeamsProfile?.name.medicalLicenseNumber || "",
      yearsOfExperience: vetAndTeamsProfile?.name.yearsOfExperience || "",
      postalCode: vetAndTeamsProfile?.name.postalCode || "",
      addressLine1: vetAndTeamsProfile?.name.addressLine1 || "",
      city: vetAndTeamsProfile?.name.city || "",
      stateProvince: vetAndTeamsProfile?.name.stateProvince || "",
      biography: vetAndTeamsProfile?.name.biography || "",
    });
    setArea(vetAndTeamsProfile?.name.area as string);
    setSpecialization(vetAndTeamsProfile?.specialization as string);
    setDuration(vetAndTeamsProfile?.duration as string);
    setOperatingHours(vetAndTeamsProfile?.OperatingHour as []);
    setQualification(vetAndTeamsProfile?.qualification as string);
    setKey((p) => vetAndTeamsProfile?.key ?? p);
    if (vetAndTeamsProfile?.key == "AvaillConst") {
      setProgress(100);
    }
    if (vetAndTeamsProfile?.key == "ProfDetails") {
      setProgress(66);
    }
  }, [vetAndTeamsProfile,vetAndTeamsProfile?.OperatingHour]);

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

  const handleDateChange = (date: string | null) => {
    setName((prevData) => ({
      ...prevData,
      dateOfBirth: date || "",
    }));
  };

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

  type Option = {
    value: string;
    label: string;
  };

  const specializationOptions: Option[] = [
    { value: "cardiology", label: "Cardiology" },
    { value: "orthopedics", label: "Orthopedics" },
    { value: "dermatology", label: "Dermatology" },
    { value: "pediatrics", label: "Pediatrics" },
    { value: "neurology", label: "Neurology" },
    { value: "radiology", label: "Radiology" },
    { value: "dentistry", label: "Dentistry" },
    { value: "psychiatry", label: "Psychiatry" },
  ];

  const areaOptions: Option[] = [
    { value: "north", label: "North Zone" },
    { value: "south", label: "South Zone" },
    { value: "east", label: "East Zone" },
    { value: "west", label: "West Zone" },
    { value: "central", label: "Central Zone" },
    { value: "urban", label: "Urban Area" },
    { value: "rural", label: "Rural Area" },
    { value: "coastal", label: "Coastal Area" },
  ];

  const handleSaveOperatingHours = useCallback((updatedHours: DayHours[]) => {
    setOperatingHours((prev) => {
      const isSame = JSON.stringify(prev) === JSON.stringify(updatedHours);
      return isSame ? prev : updatedHours;
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    try {
      const response = convertToFhirVetProfile({
        name,
        image: image || undefined,
        area,
        countryCode,
        OperatingHour,
        specialization,
        qualification,
        uploadedFiles,
        duration,
        key,
      });

      const formdata = new FormData();
      formdata.append("data", JSON.stringify(response));

      if (image) {
        formdata.append("image", image);
      }

      uploadedFiles.forEach((file) => {
        formdata.append("document[]", file);
      });

      const data = await postData(
        `/fhir/v1/Practitioner?userId=${userId}`,
        formdata,
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
        if (userId) {
          fetchVetAndTeamsProfile(userId);
        }
        router.push("/DoctorDashboard");
      }
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Failed to submit the form. Please try again later.",
      });
      console.error("Submission Error:", error);
    }
  }, [
    name,
    area,
    image,
    countryCode,
    OperatingHour,
    qualification,
    key,
    specialization,
    uploadedFiles,
    duration,
    userId,
    router,
    fetchVetAndTeamsProfile,
  ]);

  const validateStep1 = () => {
    const newErrors: ErrorType = {};
    if (!name.rcvsNumber) newErrors.rcvsNumber = "RCVSNumber is required";
    if (!name.firstName) newErrors.firstName = "First name is required";
    if (!name.lastName) newErrors.lastName = "Last name is required";
    if (!name.gender) newErrors.gender = "Gender is required";
    if (!name.dateOfBirth) newErrors.dateOfBirth = "Date of birth is required";
    if (!name.email) newErrors.email = "Email is required";
    if (!name.mobileNumber)
      newErrors.mobileNumber = "Mobile number is required";
    if (!name.postalCode) newErrors.postalCode = "Postal code is required";
    if (!area) newErrors.area = "Area is required";
    if (!name.addressLine1) newErrors.addressLine1 = "Address is required";
    if (!name.city) newErrors.city = "City is required";
    if (!name.stateProvince)
      newErrors.stateProvince = "State/Province is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors: ErrorType = {};
    if (!name.linkedin) newErrors.linkedin = "LinkedIn link is required";
    if (!name.medicalLicenseNumber)
      newErrors.medicalLicenseNumber = "Medical license number is required";
    if (!name.yearsOfExperience)
      newErrors.yearsOfExperience = "Years of experience is required";
    if (!specialization)
      newErrors.specialization = "Specialization is required";
    if (!qualification) newErrors.qualification = "Qualification is required";
    if (!name.biography) newErrors.biography = "Biography is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = (nextKey: string) => {
    let isValid = true;
    if (key === "profileInfo" && nextKey === "ProfDetails") {
      isValid = validateStep1();
      if (isValid) setProgress(66);
    } else if (key === "ProfDetails" && nextKey === "AvaillConst") {
      isValid = validateStep2();
      if (isValid) setProgress(100);
    }
    if (isValid) {
      setKey(nextKey);
    }
  };

  const handleBack = (prevKey: string) => {
    setKey(prevKey);
    setErrors({}); // Clear errors when navigating back
    if (prevKey === "profileInfo") {
      setProgress(33);
    } else if (prevKey === "ProfDetails") {
      setProgress(66);
    }
  };

  // New function to handle tab changes
  const handleTabChange = (selectedKey: string | null) => {
    if (!selectedKey) return;

    // Define tab order for determining direction
    const tabOrder = ["profileInfo", "ProfDetails", "AvaillConst"];
    const currentIndex = tabOrder.indexOf(key);
    const nextIndex = tabOrder.indexOf(selectedKey);

    if (nextIndex > currentIndex) {
      // Forward navigation: validate and update progress
      handleNext(selectedKey);
    } else {
      // Backward navigation: no validation, update progress
      setKey(selectedKey);
      setErrors({}); // Clear errors
      if (selectedKey === "profileInfo") {
        setProgress(33);
      } else if (selectedKey === "ProfDetails") {
        setProgress(66);
      } else if (selectedKey === "AvaillConst") {
        setProgress(100);
      }
    }
  };

  return (
    <>
      <section className="CompltProfileSec">
        <Container>
          <div className="mb-3">
            <HeadText blktext="Complete" Spntext="your profile" />
          </div>

          <div className="AddVetTabDiv">
            <Tab.Container activeKey={key} onSelect={handleTabChange}>
              <div className="Add_Profile_Data">
                <div>
                  <Nav variant="pills" className="VetPills">
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
                                    width={80}
                                    height={80}
                                  />
                                ) : (
                                  <div className="upload-placeholder">
                                    {vetAndTeamsProfile?.image && (
                                      <Image
                                        src={
                                          typeof vetAndTeamsProfile?.image ===
                                          "string"
                                            ? vetAndTeamsProfile.image
                                            : ""
                                        }
                                        alt="camera"
                                        className="preview-image"
                                        width={80}
                                        height={80}
                                      />
                                    )}
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
                                inname="rcvsNumber"
                                value={name.rcvsNumber}
                                inlabel="RCVS Registration Number"
                                onChange={handleBusinessInformation}
                              />
                              {errors.rcvsNumber && (
                                <p className="text-danger">
                                  {errors.rcvsNumber}
                                </p>
                              )}
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
                              {errors.firstName && (
                                <p className="text-danger">
                                  {errors.firstName}
                                </p>
                              )}
                            </Col>
                            <Col md={6}>
                              <FormInput
                                intype="text"
                                inname="lastName"
                                value={name.lastName}
                                inlabel="Last Name"
                                onChange={handleBusinessInformation}
                              />
                              {errors.lastName && (
                                <p className="text-danger">{errors.lastName}</p>
                              )}
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
                              {errors.gender && (
                                <p className="text-danger">{errors.gender}</p>
                              )}
                            </Col>
                            <Col md={6}>
                              <DynamicDatePicker
                                placeholder="Date of Birth"
                                value={name.dateOfBirth}
                                onDateChange={handleDateChange}
                              />
                              {errors.dateOfBirth && (
                                <p className="text-danger">
                                  {errors.dateOfBirth}
                                </p>
                              )}
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
                              {errors.email && (
                                <p className="text-danger">{errors.email}</p>
                              )}
                            </Col>
                          </Row>
                          <Row>
                            <Col md={12}>
                              <PhoneInput
                                countryCode={countryCode}
                                onCountryCodeChange={setCountryCode}
                                phone={name.mobileNumber}
                                onPhoneChange={(value) =>
                                  setName({ ...name, mobileNumber: value })
                                }
                              />
                              {errors.mobileNumber && (
                                <p className="text-danger">
                                  {errors.mobileNumber}
                                </p>
                              )}
                            </Col>
                          </Row>
                        </div>
                        <div className="DivideLine"></div>
                        <div className="doctadressdiv">
                          <h6>Residential Address</h6>

                          <Row>
                            <Col md={12}>
                              <FormInput
                                intype="text"
                                inname="addressLine1"
                                value={name.addressLine1}
                                inlabel="AddressLine1"
                                onChange={handleBusinessInformation}
                              />
                              {errors.addressLine1 && (
                                <p className="text-danger">
                                  {errors.addressLine1}
                                </p>
                              )}
                            </Col>
                          </Row>
                          <Row>
                            <Col md={6}>
                              <FormInput
                                intype="number"
                                inname="postalCode"
                                value={name.postalCode}
                                inlabel="Postal Code"
                                onChange={handleBusinessInformation}
                              />
                              {errors.postalCode && (
                                <p className="text-danger">
                                  {errors.postalCode}
                                </p>
                              )}
                            </Col>
                                  <Col md={6}>
                              <FormInput
                                intype="text"
                                inname="area"
                                value={area}
                                inlabel="Area"
                                onChange={(e)=>setArea(e.target.value)}
                              />
                              {errors.area && (
                                <p className="text-danger">
                                  {errors.area}
                                </p>
                              )}
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
                              {errors.city && (
                                <p className="text-danger">{errors.city}</p>
                              )}
                            </Col>
                            <Col md={6}>
                              <FormInput
                                intype="text"
                                inname="stateProvince"
                                value={name.stateProvince}
                                inlabel="State/Province"
                                onChange={handleBusinessInformation}
                              />
                              {errors.stateProvince && (
                                <p className="text-danger">
                                  {errors.stateProvince}
                                </p>
                              )}
                            </Col>
                          </Row>
                        </div>
                        <div className="ComptBtn">
                          <Button onClick={() => handleNext("ProfDetails")}>
                            Next <IoIosArrowDropright />
                          </Button>
                        </div>
                      </Form>
                    </Tab.Pane>
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
                            {errors.linkedin && (
                              <p className="text-danger">{errors.linkedin}</p>
                            )}
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
                            {errors.medicalLicenseNumber && (
                              <p className="text-danger">
                                {errors.medicalLicenseNumber}
                              </p>
                            )}
                          </Col>
                          <Col md={6}>
                            <FormInput
                              intype="number"
                              inname="yearsOfExperience"
                              value={name.yearsOfExperience}
                              inlabel="Years of Experience"
                              onChange={handleBusinessInformation}
                            />
                            {errors.yearsOfExperience && (
                              <p className="text-danger">
                                {errors.yearsOfExperience}
                              </p>
                            )}
                          </Col>
                        </Row>
                        <Row>
                          <Col md={12}>
                            <FormInput
                              intype="text"
                              inname="qualification"
                              value={qualification}
                              inlabel="Qualification (MBBS, MD, etc.)"
                              onChange={(e) => setQualification(e.target.value)}
                            />
                            {errors.linkedin && (
                              <p className="text-danger">
                                {errors.qualification}
                              </p>
                            )}
                          </Col>
                        </Row>
                        <Row>
                          <Col md={12}>
                            <DynamicSelect
                              options={specializationOptions}
                              value={specialization}
                              onChange={setSpecialization}
                              inname="Specialisation"
                              placeholder="Specialisation"
                            />
                            {errors.specialization && (
                              <p className="text-danger">
                                {errors.specialization}
                              </p>
                            )}
                          </Col>
                        </Row>
                        <Row>
                          <Col md={12}>
                            <div className="FormTexediv">
                              <FloatingLabel
                                className="textarealabl"
                                controlId="floatingTextarea2"
                                label="Biography/Short Description"
                              >
                                <Form.Control
                                  as="textarea"
                                  placeholder="Leave a comment here"
                                  value={name.biography}
                                  style={{ height: "100px" }}
                                  onChange={(e) =>
                                    setName({
                                      ...name,
                                      biography: e.target.value,
                                    })
                                  }
                                />
                              </FloatingLabel>
                              {errors.biography && (
                                <p className="text-danger">
                                  {errors.biography}
                                </p>
                              )}
                            </div>
                          </Col>
                        </Row>
                        <Row>
                          <Col md={12}>
                            <UploadImage
                              value={uploadedFiles}
                              onChange={setUploadedFiles}
                              existingFiles={apiFiles}
                            />
                          </Col>
                        </Row>
                        <div className="ComptBtn twbtn">
                          <Button
                            className="Hov"
                            onClick={() => handleBack("profileInfo")}
                          >
                            <IoIosArrowDropleft /> Back
                          </Button>
                          <Button onClick={() => handleNext("AvaillConst")}>
                            Next <IoIosArrowDropright />
                          </Button>
                        </div>
                      </Form>
                    </Tab.Pane>
                    <Tab.Pane eventKey="AvaillConst">
                      <Form className="ServiceData">
                        <OperatingHours
                          onSave={handleSaveOperatingHours}
                          value={OperatingHour}
                        />
                        <div className="ComptBtn twbtn">
                          <Button
                            className="Hov"
                            onClick={() => handleBack("ProfDetails")}
                          >
                            <IoIosArrowDropleft /> Back
                          </Button>
                          <Button onClick={handleSubmit}>
                            <FaCircleCheck /> Finish
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
                    onclicked={handleSubmit}
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
