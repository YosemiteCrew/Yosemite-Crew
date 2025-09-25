'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./CompleteProfile.css";
import { countries } from "country-list-json";
import { Button, Col, Container, Form, Nav, Row, Tab } from "react-bootstrap";
import { IoIosArrowDropleft, IoIosArrowDropright, IoMdArrowDropdown, IoMdArrowDropup } from "react-icons/io";
import { FaCircleCheck, FaSackDollar, FaSuitcaseMedical } from "react-icons/fa6";
import ProfileProgressbar from "@/app/Components/ProfileProgressbar/ProfileProgressbar";
import { IoLocationSharp, IoSearchOutline } from "react-icons/io5";
import { FormInput } from "../Sign/SignUp";
import DynamicSelect from "@/app/Components/DynamicSelect/DynamicSelect";
import Image from "next/image";

import { getData, postData } from "@/app/axios-services/services";
import { convertFHIRToAdminDepartments, toFHIRBusinessProfile } from "@yosemite-crew/fhir"
import { useOldAuthStore } from "@/app/stores/oldAuthStore";
import { useRouter } from "next/navigation";
import { LoadScript, Autocomplete } from "@react-google-maps/api";

type Option = {
  value: string;
  label: string;
};

const servicesList = [
  { code: "E001", display: "Internal Medicine" },
  { code: "S001", display: "24/7 Emergency Care" },
  { code: "V001", display: "Surgery and Operating Rooms" },
  { code: "D001", display: "Parasitology" },
  { code: "B001", display: "Dental Clinic" },
];

// const servicesList1 = [
//   { code: "E001", display: "Internal Medicine" },
//   { code: "S001", display: "Surgery" },
//   { code: "V001", display: "Pain Management" },
//   { code: "D001", display: "Parasitology" },
//   { code: "B001", display: "Behavioural Therapy" },
// ];


function CompleteProfile() {
  const { userId, profile } = useOldAuthStore();
  const autoCompleteRef: any = useRef("");
  const router = useRouter();
  //  console.log(profile,222222)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isDropdownOpen1, setIsDropdownOpen1] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchTerm1, setSearchTerm1] = useState("");
  const [key, setKey] = useState<string>("business");
  const [image, setImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const sanitizedPreview = previewUrl;
  const [progress, setProgress] = useState<number>(0);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [addDepartment, setAddDepartment] = useState<string[]>([]);
  const [departmentFeatureActive, setdepartmentFeatureActive] = useState("");
  const [country, setCountry] = useState<string>("");
  const [servicesList1, setServicesList1] = useState([{code:"",display:""}])
  const [name, setName] = useState({
    userId: "",
    businessName: "",
    website: "",
    registrationNumber: "",
    city: "",
    state: "",
    area: "",
    addressLine1: "",
    latitude: "",
    longitude: "",
    postalCode: "",
    phoneNumber: ""
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [showValidation, setShowValidation] = useState(false);

  useEffect(() => {
    if (userId && name.userId !== userId) {
      setName(prev => ({ ...prev, userId }));
    }
  }, [userId, name.userId]);

useEffect(()=>{
  const getDpartments = async()=>{
  try {
    const data = await getData(`/api/auth/getDepartmentsList`)
    if (data){
      const response:any = data.data
      const DepData = convertFHIRToAdminDepartments(response.data)
      setServicesList1(DepData.map((v)=>({
        code:v._id,
        display:v.name
      })))
    }
  } catch (error) {
    console.error(error)
  }
}
getDpartments()
},[])

  useEffect(() => {
    
    if (profile) {
      setName({
        userId: profile?.name?.userId as string,
        businessName: profile?.name?.businessName || "",
        website: profile?.name?.website || "",
        registrationNumber: profile?.name?.registrationNumber || "",
        city: profile?.name?.city || "",
        state: profile?.name?.state || "",
        area: profile?.name?.area || "",
        addressLine1: profile?.name?.addressLine1 || "",
        latitude: profile?.name?.latitude || "",
        longitude: profile?.name?.longitude || "",
        postalCode: profile?.name?.postalCode || "",
        phoneNumber: profile?.name?.phoneNumber || ""
      })
      setCountry(profile?.name?.country as string)
      setAddDepartment(profile?.addDepartment||"")
      setSelectedServices(profile.selectedServices)
      setdepartmentFeatureActive(profile.departmentFeatureActive)
      setKey(profile.key as string)
      setProgress(profile.progress as number)
    }
  }, [profile])



  const handleBusinessInformation = useCallback((e: { target: { name: string; value: string; }; }) => {
    const { name, value } = e.target;
    setName((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  }, []);

  // const handleArea = (selectedOption: any) => {
  //   setName((prev) => ({
  //     ...prev,
  //     area: selectedOption
  //   }));
  // };

  const Option1: Option[] = useMemo(() =>
    countries.map((v) => ({
      value: v.code,
      label: `${v.flag} ${v.name}`,
    })), []
  );

  const options: Option[] = [
    { value: 'us', label: '🇺🇸 United States' },
    { value: 'in', label: '🇮🇳 India' },
    { value: 'uk', label: '🇬🇧 United Kingdom' },
  ];
  const handleSelectService = useCallback((service: { code: string; display: string }) => {
    setSelectedServices((prevSelected) => {
      const isSelected = prevSelected.includes(service.display);
      return isSelected
        ? prevSelected.filter((s) => s !== service.display)
        : [...prevSelected, service.display];
    });
  }, []);

  const handleSelectService1 = useCallback((service: { code: string; display: string }) => {
    setAddDepartment((prev) => {
      const isSelected = prev.includes(service.code);
      return isSelected
        ? prev.filter((s) => s !== service.code)
        : [...prev, service.code];
    });
  }, []);


  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const toggleDropdown1 = () => {
    setIsDropdownOpen1(!isDropdownOpen1);
  };

  const handleSearch = (event: { target: { value: React.SetStateAction<string>; }; }) => {
    setSearchTerm(event.target.value);
  };

  const handleSearch1 = (event: { target: { value: React.SetStateAction<string>; }; }) => {
    setSearchTerm1(event.target.value);
  };

  const filteredServices = useMemo(() =>
    servicesList.filter((service) =>
      service.display.toLowerCase().includes(searchTerm.toLowerCase())
    ), [searchTerm]
  );

  const filteredServices1 = useMemo(() =>
    servicesList1?.filter((service:any) =>
      service.display.toLowerCase().includes(searchTerm1.toLowerCase())
    ), [servicesList1,searchTerm1]
  );

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
    }
  };

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

  const handleModeClick = (mode: React.SetStateAction<string>) => {
    if (departmentFeatureActive.includes("yes") && departmentFeatureActive.includes("no")) {
      setdepartmentFeatureActive(mode);
    } else {
      setdepartmentFeatureActive(mode);
    }
  };



  // Validation for each step
  const validateBusiness = () => {
    const newErrors: { [key: string]: string } = {};
    // if (!image) newErrors.image = "Image is required";
    if (!country) newErrors.country = "Country is required";
    if (!name.registrationNumber) newErrors.registrationNumber = "Registration Number is required";
    if (!name.businessName) newErrors.businessName = "Business Name is required";
    if (!name.phoneNumber) newErrors.phoneNumber = "Phone Number is required";
    // Website is optional
    return newErrors;
  };

  const validateAddress = () => {
    const newErrors: { [key: string]: string } = {};
    if (!name.postalCode) newErrors.postalCode = "Postal Code is required";
    if (!country) newErrors.country = "Country is required";
    if (!name.addressLine1) newErrors.addressLine1 = "Address Line 1 is required";
    if (!name.city) newErrors.city = "City is required";
    if (!name.state) newErrors.state = "State is required";
    return newErrors;
  };

  const validateService = () => {
    const newErrors: { [key: string]: string } = {};
    if (selectedServices.length === 0) newErrors.selectedServices = "At least one service must be selected";
    if (addDepartment.length === 0) newErrors.addDepartment = "At least one department must be selected";
    return newErrors;
  };

  // Handler for tab change with validation (no validation on back)
  const handleTabSelect = (nextKey: string) => {
    let stepErrors: { [key: string]: string } = {};

    // Step validation when moving forward
    if (
      (key === "business" && nextKey === "address") ||
      (key === "address" && nextKey === "service")
    ) {
      if (key === "business") stepErrors = validateBusiness();
      if (key === "address") stepErrors = validateAddress();

      if (Object.keys(stepErrors).length > 0) {
        setErrors(stepErrors);
        setShowValidation(true);
        return; // Stop tab switch if there are errors
      }
    }

    // Clear errors and move to next tab
    setErrors({});
    setShowValidation(false);
    setKey(nextKey);

    // Update progress based on nextKey
    const progressMap: { [key: string]: number } = {
      business: 0,
      address: 33,
      service: 66,
      review: 100,
    };

    setProgress(progressMap[nextKey] ?? 0);
  };

  const handleSubmit = async () => {
    let stepErrors: { [key: string]: string } = {};
    if (key === "business") stepErrors = validateBusiness();
    if (key === "address") stepErrors = validateAddress();
    if (key === "service") stepErrors = validateService()

    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      setShowValidation(true);
      return; // Stop tab switch if there are errors
    }
    const fhirPayload = toFHIRBusinessProfile({
      name,
      country,
      departmentFeatureActive,
      selectedServices,
      addDepartment,
      key,
      progress: key === "service" ? 100 : progress
    });

    const formData = new FormData();

    if (image) {
      formData.append("image", image);
    }

    formData.append("fhirPayload", JSON.stringify(fhirPayload));

    try {
      const response = await postData(`/api/auth/organization`, formData, {
        headers: {
          "Content-Type": "multipart/form-data", // Optional: depends on your `postData` helper
        },
      });

      if (response.status === 200) {
       
        router.push("/emptydashboard"); // Redirect to dashboard or another page
      }
    } catch (error) {
      console.error("Submit failed:", error);
    }
  };


  const extractAddressDetails = (place: any) => {
    const addressResp = {
      address: "",
      street: "",
      area: "", // <-- Added
      city: "",
      state: "",
      postalCode: "", // <-- fixed key to match your `handlePlaceSelect` usage
      country: "",
      lat: place.geometry?.location?.lat(),
      long: place.geometry?.location?.lng(),
    };

    const address_components = place.address_components || [];

    address_components.forEach((component: any) => {
      const types = component.types;

      if (types.includes("route")) {
        addressResp.street = component.long_name;
      }
      if (types.includes("sublocality") || types.includes("sublocality_level_1") || types.includes("neighborhood")) {
        addressResp.area = component.long_name; // <-- Extract area or locality
      }
      if (types.includes("locality")) {
        addressResp.city = component.long_name;
      }
      if (types.includes("administrative_area_level_1")) {
        addressResp.state = component.short_name;
      }
      if (types.includes("postal_code")) {
        addressResp.postalCode = component.long_name;
      }
      if (types.includes("country")) {
        addressResp.country = component.long_name;
      }
    });

    return addressResp;
  };


  const libraries: any | [] = ["places"];
  const handlePlaceSelect = () => {
    if (autoCompleteRef.current) {
      const place = autoCompleteRef.current.getPlace();
      console.log("placesss", place)
      if (!place || !place.formatted_address) return; // Ensure a valid selection

      const firstPartOfAddress = String(place.formatted_address).split(",")[0]; // Extract first part

      const placeDetails: any = extractAddressDetails(place);

      if (placeDetails) {
        setName((prevState) => ({
          ...prevState,
          addressLine1: firstPartOfAddress, // Set first part of address
          area: placeDetails.area || "",
          city: placeDetails.city || "",
          state: placeDetails.state || "",
          postalCode: placeDetails.postalCode || "",
          latitude: placeDetails.lat || "",
          longitude: placeDetails.long || "",
        }));
      }
    }
  };
  return (
    <>
      <section className="CompltProfileSec">
        <Container>

          <div className="mb-3">
            <HeadText blktext="Set up" Spntext="your profile" />
          </div>

          <div className="AddVetTabDiv">
            <Tab.Container activeKey={key} onSelect={(k) => { if (typeof k === "string") handleTabSelect(k); }}>
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
                            <Col md={12}>

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
                                  {/* {image && sanitizedPreview ? (
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
                                        src={profile?.image as any}
                                        alt="camera"
                                        className="icon"
                                        width={40}
                                        height={40}
                                      />
                                    </div>
                                  )} */}
                                </label>
                                <h5>Add Profile Picture</h5>
                                {showValidation && errors.image && (
                                  <div style={{ color: "#b30000", marginTop: 4, fontSize: 13 }}>
                                    {errors.image}
                                  </div>
                                )}
                              </div>

                            </Col>

                          </Row>
                          <Row>
                            <Col md={6}>
                              <DynamicSelect
                                options={Option1}
                                value={country}
                                onChange={setCountry}
                                inname="country"
                                placeholder="Select Country"
                              />
                              {showValidation && errors.country && (
                                <div style={{ color: "#b30000", marginTop: 4, fontSize: 13 }}>
                                  {errors.country}
                                </div>
                              )}
                            </Col>
                            <Col md={6}>
                              <FormInput intype="text" inname="registrationNumber" value={name.registrationNumber} inlabel="Business Registration Number/PIMS ID" onChange={handleBusinessInformation} />
                              {showValidation && errors.registrationNumber && (
                                <div style={{ color: "#b30000", marginTop: 4, fontSize: 13 }}>
                                  {errors.registrationNumber}
                                </div>
                              )}
                            </Col>
                          </Row>
                          <Row>
                            <Col md={12}>
                              <FormInput intype="text" inname="businessName" value={name.businessName} inlabel="Business Name" onChange={handleBusinessInformation} />
                              {showValidation && errors.businessName && (
                                <div style={{ color: "#b30000", marginTop: 4, fontSize: 13 }}>
                                  {errors.businessName}
                                </div>
                              )}
                            </Col>
                          </Row>
                          <Row>
                            <Col md={12}>
                              <FormInput intype="number" inname="phoneNumber" value={name.phoneNumber} inlabel="Phone Number" onChange={handleBusinessInformation} />
                              {showValidation && errors.phoneNumber && (
                                <div style={{ color: "#b30000", marginTop: 4, fontSize: 13 }}>
                                  {errors.phoneNumber}
                                </div>
                              )}
                            </Col>
                          </Row>
                          <Row>
                            <Col md={12}>
                              <FormInput intype="text" inname="website" value={name.website} inlabel="Website(Optional)" onChange={handleBusinessInformation} />
                            </Col>
                          </Row>
                        </div>

                        <div className="ComptBtn">
                          <Button onClick={() => handleTabSelect("address")}>
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
                              <Col md={12}>
                                <LoadScript
                                  googleMapsApiKey={process.env.NEXT_PUBLIC_BASE_GOOGLE_MAPS_API_KEY as string} libraries={libraries}
                                >
                                  <Autocomplete
                                    fields={[
                                      "geometry",
                                      "place_id",
                                      "formatted_address",
                                      "address_components",
                                    ]}
                                    onLoad={(ref) => (autoCompleteRef.current = ref)}
                                    onPlaceChanged={handlePlaceSelect}
                                  >
                                    <FormInput
                                      intype="text"
                                      inname="addressLine1"
                                      value={name.addressLine1}
                                      inlabel="Address Line 1"
                                      onChange={handleBusinessInformation}
                                    />
                                  </Autocomplete>
                                </LoadScript>

                                {showValidation && errors.addressLine1 && (
                                  <div style={{ color: "#b30000", marginTop: 4, fontSize: 13 }}>
                                    {errors.addressLine1}
                                  </div>
                                )}
                              </Col>
                            </Row>

                            <Row>
                              <Col md={6}>
                                <FormInput intype="number" inname="postalCode" value={name.postalCode} inlabel="Postal Code" onChange={handleBusinessInformation} />
                                {showValidation && errors.postalCode && (
                                  <div style={{ color: "#b30000", marginTop: 4, fontSize: 13 }}>
                                    {errors.postalCode}
                                  </div>
                                )}
                              </Col>
                              <Col md={6}>
                                <FormInput
                                  intype="text"
                                  value={name.area}
                                  onChange={handleBusinessInformation}
                                  inname="area"
                                  inlabel="Area"
                                />
                                {showValidation && errors.country && (
                                  <div style={{ color: "#b30000", marginTop: 4, fontSize: 13 }}>
                                    {errors.country}
                                  </div>
                                )}
                              </Col>
                            </Row>
                            
                            <Row>
                              <Col md={6}>
                                <FormInput intype="text" inname="city" value={name.city} inlabel="City" onChange={handleBusinessInformation} />
                                {showValidation && errors.city && (
                                  <div style={{ color: "#b30000", marginTop: 4, fontSize: 13 }}>
                                    {errors.city}
                                  </div>
                                )}
                              </Col>
                              <Col md={6}>
                                <FormInput intype="text" inname="state" value={name.state} inlabel="State" onChange={handleBusinessInformation} />
                                {showValidation && errors.state && (
                                  <div style={{ color: "#b30000", marginTop: 4, fontSize: 13 }}>
                                    {errors.state}
                                  </div>
                                )}
                              </Col>
                            </Row>
                          </div>
                        </div>

                        <div className="ComptBtn twbtn">
                          <Button className="Hov" onClick={() => handleTabSelect("business")}>
                            <IoIosArrowDropleft /> Back
                          </Button>
                          <Button onClick={() => handleTabSelect("service")}>
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
                              {isDropdownOpen ? <IoMdArrowDropup size={20} /> : <IoMdArrowDropdown size={20} />}
                            </span>
                          </div>
                          {isDropdownOpen && (
                            <div className="ServDropcontent">
                              <div className="serchbtn">
                                <IoSearchOutline size={20} />
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
                                    className={`service-item ${selectedServices.includes(service.display) ? "selected" : ""}`}
                                  >
                                    <label>
                                      <input
                                        type="checkbox"
                                        className="form-check-input"
                                        checked={selectedServices.includes(service.display)}
                                        onChange={() => handleSelectService(service)}
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
                                className={departmentFeatureActive === "yes" ? "active" : ""}
                                onClick={() => handleModeClick("yes")}
                              >
                                Yes
                              </li>
                              <li
                                className={departmentFeatureActive === "no" ? "active" : ""}
                                onClick={() => handleModeClick("no")}
                              >
                                No
                              </li>
                            </ul>
                          </div>
                        </div>

                        <div className="services_dropdown">
                          <div
                            className={`ServHeadr ${isDropdownOpen1 ? "open" : ""}`}
                            onClick={toggleDropdown1}
                          >
                            <span>Add Department</span>
                            <span className="arrow">
                              {isDropdownOpen ? <IoMdArrowDropup /> : <IoMdArrowDropdown />}
                            </span>
                          </div>
                          {isDropdownOpen1 && (
                            <div className="ServDropcontent">
                              <div className="serchbtn">
                                <IoSearchOutline size={20} />
                                <input
                                  type="text"
                                  className="search-input"
                                  placeholder="Search"
                                  value={searchTerm1}
                                  onChange={handleSearch1}
                                />
                              </div>
                              <ul className="services-list">
                                {filteredServices1.map((service) => (
                                  <li
                                    key={service.code}
                                    className={`service-item ${addDepartment.includes(service.display) ? "selected" : ""}`}
                                  >
                                    <label>
                                      <input
                                        type="checkbox"
                                        className="form-check-input"
                                        checked={addDepartment.includes(service.code)}
                                        onChange={() => handleSelectService1(service)}
                                      />
                                      <p>{service.display}</p>
                                    </label>
                                  </li>
                                ))}
                              </ul>

                            </div>
                          )}
                        </div>
                        {showValidation && errors.selectedServices && (
                          <div style={{ color: "#b30000", marginTop: 4, fontSize: 13 }}>
                            {errors.selectedServices}
                          </div>
                        )}
                        {showValidation && errors.addDepartment && (
                          <div style={{ color: "#b30000", marginTop: 4, fontSize: 13 }}>
                            {errors.addDepartment}
                          </div>
                        )}
                        <div className="ComptBtn twbtn">
                          <Button
                            className="Hov"
                            onClick={() => handleTabSelect("address")}>
                            <IoIosArrowDropleft /> Back
                          </Button>
                          <Button onClick={async () => {
                            const stepErrors = validateService();
                            if (Object.keys(stepErrors).length > 0) {
                              setErrors(stepErrors);
                              setShowValidation(true);
                              return;
                            }
                            setErrors({});
                            setShowValidation(false);
                            await handleSubmit();
                          }}>
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
                    onclicked={() => handleSubmit()}
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
