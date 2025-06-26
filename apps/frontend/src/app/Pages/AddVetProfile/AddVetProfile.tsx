"use client";
import React, { useState, useEffect } from "react";
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

function AddVetProfile() {

    const [country, setCountry] = useState<string>(''); //Set country
    const [progress] = useState(48); // Progressbar cound
    const [key, setKey] = useState("profileInfo");
    const [image, setImage] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string>("");
    const [ setOperatingHours] = useState([]);
    const sanitizedPreview = previewUrl;

  // Input Feild Started
  const [name, setName] = useState({
    registrationNumber: "",
    fname: "",
    lname: "",
    email: "",
    gender: "",
    dob: "",
    linkedin: "",
    medlnum: "",
    expir: "",
  });

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
      dob: date || "",
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

  const options: Option[] = [
    { value: 'us', label: '🇺🇸 United States' },
    { value: 'in', label: '🇮🇳 India' },
    { value: 'uk', label: '🇬🇧 United Kingdom' },
  ];


 

  // Add state for phone and country code
  const [countryCode, setCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");


   const handleSaveOperatingHours = (updatedHours: React.SetStateAction<never[]>) => {
    setOperatingHours(updatedHours);
  };






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
                                inname="fname"
                                value={name.fname}
                                inlabel="First Name"
                                onChange={handleBusinessInformation}
                              />
                            </Col>
                            <Col md={6}>
                              <FormInput
                                intype="text"
                                inname="lname"
                                value={name.lname}
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
                                value={name.dob}
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
                                phone={phone}
                                onPhoneChange={setPhone}
                              />
                            </Col>
                          </Row>
                        </div>
                        <div className="DivideLine"></div>

                        <div className="doctadressdiv">
                          <h6>Residential Address</h6>
                          <Row>
                            <Col md={6}></Col>
                            <Col md={6}></Col>
                          </Row>
                          <Row>
                            <Col md={12}></Col>
                          </Row>
                          <Row>
                            <Col md={6}></Col>
                            <Col md={6}></Col>
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
                              inname="medlnum"
                              value={name.medlnum}
                              inlabel="Medical License Number"
                              onChange={handleBusinessInformation}
                            />
                          </Col>
                          <Col md={6}>
                            <FormInput
                              intype="number"
                              inname="expir"
                              value={name.expir}
                              inlabel="Years of Experience"
                              onChange={handleBusinessInformation}
                            />
                          </Col>
                        </Row>
                        <Row>
                          <Col md={12}>
                            <DynamicSelect options={options}  value={country}  onChange={setCountry} inname="Specialisation"placeholder="Specialisation"/>
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
                                    />
                                </FloatingLabel>
                            </div>
                        </Col>
                        </Row>
                        <Row>
                        <Col md={12}>
                            <UploadImage/>
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
                        <OperatingHours onSave={handleSaveOperatingHours}/>
                        <div className="ComptBtn twbtn">
                          <Button
                            className="Hov"
                            onClick={() => setKey("ProfDetails")}
                          >
                            <IoIosArrowDropleft /> Back
                          </Button>
                          <Button onClick={() => setKey("login")}>
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
