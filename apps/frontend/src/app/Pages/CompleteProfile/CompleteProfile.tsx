'use client';
import React, { useCallback, useEffect, useState } from "react";
import "./CompleteProfile.css";
import { Button, Col, Container, Form, Nav, Row, Tab } from "react-bootstrap";
import { IoIosArrowDropleft, IoIosArrowDropright, IoMdArrowDropdown, IoMdArrowDropup } from "react-icons/io";
import { FaCircleCheck, FaSackDollar, FaSuitcaseMedical } from "react-icons/fa6";
import ProfileProgressbar from "@/app/Components/ProfileProgressbar/ProfileProgressbar";
import { IoLocationSharp } from "react-icons/io5";
import { FormInput } from "../Sign/SignUp";
import DynamicSelect from "@/app/Components/DynamicSelect/DynamicSelect";

function CompleteProfile() {

    const [country, setCountry] = useState<string>(''); //Set country
    const [isDropdownOpen, setIsDropdownOpen] = useState(false); //add services
    const [searchTerm, setSearchTerm] = useState(""); //Search Tearm
    const [selectedServices, setSelectedServices] = useState([]); //SelectService
    console.log("selectedServices", selectedServices);
    const [activeModes, setActiveModes] = useState("yes"); //Department

    const [name, setName] = useState({
        businessName:"",
        website:"",
        registrationNumber:"",
        compCity:"",
        compState:"",
        compAddress:"",
        postalCode:"",

    });

    const handleBusinessInformation = (e) => {
    const { name, value } = e.target;
        setName((prevData) => ({
        ...prevData,
        [name]: value,
        }));
    };

   type Option = {
    value: string;
    label: string;
  };

  const options: Option[] = [
    { value: 'us', label: '🇺🇸 United States' },
    { value: 'in', label: '🇮🇳 India' },
    { value: 'uk', label: '🇬🇧 United Kingdom' },
  ];


   
    const [progress, setProgress] = useState(48); // Progressbar cound 
    const [key, setKey] = useState("business");


    const servicesList = [
      { code: "E001", display: "Internal Medicine" },
      { code: "S001", display: "24/7 Emergency Care" },
      { code: "V001", display: "Surgery and Operating Rooms" },
      { code: "D001", display: "Parasitology" },
      { code: "B001", display: "Dental Clinic" },
    ];

    //  Add Services  Started
      const handleSelectService = (service) => {
      setSelectedServices((prevSelected) => {
        const isSelected = prevSelected.some((s) => s.code === service.code);

      return isSelected
          ? prevSelected.filter((s) => s.code !== service.code) // Remove if already selected
          : [...prevSelected, { code: service.code, display: service.display }];
        });
      };
      const toggleDropdown = () => {
        setIsDropdownOpen(!isDropdownOpen);
      }; 
      const handleSearch = (event) => {
        setSearchTerm(event.target.value);
      };
       const filteredServices = servicesList.filter((service) =>
        service.display.toLowerCase().includes(searchTerm.toLowerCase())
      );
      

    // Add Services  Ended

    const handleModeClick = (mode) => {
      if (activeModes.includes("yes") && activeModes.includes("no")) {
        setActiveModes(mode);
      } else {
        setActiveModes(mode);
      }
    };

  return (
    <>
      <section className="CompltProfileSec">
        <Container>

          <div className="mb-3">
            <HeadText blktext="Set up" Spntext="your profile"/>
          </div>

          <div className="AddVetTabDiv">
            <Tab.Container activeKey={key} onSelect={(k) => setKey(k)}>
              <div className="Add_Profile_Data">
                <div>
                  <Nav variant="pills" className=" VetPills">

                    <Nav.Item>
                      <Nav.Link eventKey="business">
                        <span><FaSackDollar /></span> Business Information
                      </Nav.Link>
                    </Nav.Item>

                    <Nav.Item>
                      <Nav.Link eventKey="address">
                        <span><IoLocationSharp /></span> Address
                      </Nav.Link>
                    </Nav.Item>

                    <Nav.Item>
                      <Nav.Link eventKey="service">
                        <span><FaSuitcaseMedical /></span> Service and Department
                      </Nav.Link>
                    </Nav.Item>

                  </Nav>
                </div>
                <div></div>
              </div>

              <div className="Add_Profile_Data">
                <div className="LeftProfileDiv">
                  <Tab.Content>
                    {/* business Information */}
                    <Tab.Pane eventKey="business">
                      <Form className="ComplteBusiness">

                        <div className="BusinessInptData">
                            <Row>
                                <Col md={6}>
                                  <DynamicSelect
                                    options={options}
                                    value={country}
                                    onChange={setCountry}
                                    inname="country"
                                    placeholder="Select Country"
                                    />
                                </Col>
                                <Col md={6}>
                                    <FormInput intype="text" inname="registrationNumber" value={name.registrationNumber} inlabel="Business Registration Number/PIMS ID" onChange={handleBusinessInformation} />
                                </Col>
                            </Row>
                            <Row>
                                <Col md={12}>
                                    <FormInput intype="text" inname="businessName" value={name.businessName} inlabel="Business Name" onChange={handleBusinessInformation} />
                                </Col>
                            </Row>
                            <Row>
                                <Col md={12}>
                                    <FormInput intype="text" inname="website" value={name.website} inlabel="Website(Optional)" onChange={handleBusinessInformation} />
                                </Col>
                            </Row>
                        </div>

                        <div className="ComptBtn">
                          <Button onClick={() => setKey("address")}>
                            Get Started <IoIosArrowDropright />
                          </Button>
                        </div>

                      </Form>
                    </Tab.Pane>

                    {/* address Details */}
                    <Tab.Pane eventKey="address">

                      <Form className="CompltAddress">

                        <div className="AdrsDiv">
                            <h5>Address</h5>
                            <div className="adrinpt">
                                <Row>
                                    <Col md={6}><FormInput intype="number" inname="postalCode" value={name.postalCode} inlabel="Postal Code" onChange={handleBusinessInformation} /></Col>
                                    <Col md={6}>
                                      <DynamicSelect
                                      options={options}
                                      value={country}
                                      onChange={setCountry}
                                      inname="country"
                                      placeholder="Area"
                                      />
                                    </Col>
                                </Row>
                                <Row>
                                    <Col md={12}><FormInput intype="text" inname="compAddress" value={name.compAddress} inlabel="Address Line 1" onChange={handleBusinessInformation} /></Col>
                                </Row>
                                <Row>
                                    <Col md={6}><FormInput intype="text" inname="compCity" value={name.compCity} inlabel="City" onChange={handleBusinessInformation} /></Col>
                                    <Col md={6}><FormInput intype="text" inname="compState" value={name.compState} inlabel="State" onChange={handleBusinessInformation} /></Col>
                                </Row>
                            </div>
                        </div>

                        <div className="ComptBtn twbtn">
                          <Button className="Hov"
                            onClick={() => setKey("business")}>
                            <IoIosArrowDropleft /> Back
                          </Button>
                          <Button onClick={() => setKey("service")}>
                            Next <IoIosArrowDropright />
                          </Button>
                        </div>

                      </Form>




                    </Tab.Pane>

                    {/* service & Consultation */}
                    <Tab.Pane eventKey="service">


                      <Form className="ServiceData">

                        <div className="services_dropdown">
                          <div
                            className={`ServHeadr ${isDropdownOpen ? "open" : ""}`}
                            onClick={toggleDropdown}
                          >
                            <span>Add Services</span>
                            <span className="arrow">
                              {isDropdownOpen ? <IoMdArrowDropup /> : <IoMdArrowDropdown />}
                            </span>
                          </div>
                          {isDropdownOpen && (
                            <div className="ServDropcontent">
                              <div className="serchbtn">
                                <i className="ri-search-line"></i>
                                <input
                                  type="text"
                                  className="search-input"
                                  placeholder="Search"
                                  value={searchTerm}
                                  onChange={handleSearch}
                                />
                              </div>
                              <ul className="services-list">
                                {filteredServices.map((service) => (
                                  <li
                                    key={service.code}
                                    className={`service-item ${
                                      selectedServices.includes(service.code)
                                        ? "selected"
                                        : ""
                                    }`}
                                  >
                                    <label>
                                      <input
                                        type="checkbox"
                                        className="form-check-input"
                                        checked={selectedServices.some(
                                          (s) => s.code === service.code
                                        )}
                                        onChange={() =>
                                          handleSelectService(service)
                                        }
                                      />
                                      <p>{service.display}</p>
                                    </label>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        <div className="DepartDiv">
                          <p> Does your business have specialized departments?</p>
                          <div className="ConstModeUl">
                            <ul>
                              <li
                                className={activeModes === "yes" ? "active" : ""}
                                onClick={() => handleModeClick("yes")}
                              >
                                Yes
                              </li>
                              <li
                                className={activeModes === "no" ? "active" : ""}
                                onClick={() => handleModeClick("no")}
                              >
                                No
                              </li>
                            </ul>
                          </div>
                        </div>

                        <div className="services_dropdown">
                          <div
                            className={`ServHeadr ${isDropdownOpen ? "open" : ""}`}
                            onClick={toggleDropdown}
                          >
                            <span>Add Department</span>
                            <span className="arrow">
                              {isDropdownOpen ? <IoMdArrowDropup /> : <IoMdArrowDropdown />}
                            </span>
                          </div>
                          {isDropdownOpen && (
                            <div className="ServDropcontent">
                              <div className="serchbtn">
                                <i className="ri-search-line"></i>
                                <input
                                  type="text"
                                  className="search-input"
                                  placeholder="Search"
                                  value={searchTerm}
                                  onChange={handleSearch}
                                />
                              </div>
                              <ul className="services-list">
                                {filteredServices.map((service) => (
                                  <li
                                    key={service.code}
                                    className={`service-item ${
                                      selectedServices.includes(service.code)
                                        ? "selected"
                                        : ""
                                    }`}
                                  >
                                    <label>
                                      <input
                                        type="checkbox"
                                        className="form-check-input"
                                        checked={selectedServices.some(
                                          (s) => s.code === service.code
                                        )}
                                        onChange={() =>
                                          handleSelectService(service)
                                        }
                                      />
                                      <p>{service.display}</p>
                                    </label>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        
                       

                        <div className="ComptBtn twbtn">
                          <Button
                            className="Hov"
                            onClick={() => setKey("address")}>
                            <IoIosArrowDropleft /> Back
                          </Button>
                          <Button onClick={() => setKey("login")}>
                            <FaCircleCheck />
                            Submit
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

export default CompleteProfile;


type HeadTextProps = {
  Spntext: string;
  blktext: string;
  spanFirst?: boolean; // Optional, default is false
}

export function HeadText({ Spntext, blktext, spanFirst = false }: HeadTextProps) {
  return (
    <div className="Headingtext">
      <h3>
        {spanFirst ? (
          <>
            <span>{Spntext}</span> {blktext}
          </>
        ) : (
          <>
            {blktext} <span>{Spntext}</span>
          </>
        )}
      </h3>
    </div>
  );
}





