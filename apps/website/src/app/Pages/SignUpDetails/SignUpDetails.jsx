import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios'; // Make sure axios is installed
import './SignUpDetails.css';
import { Forminput, HeadText } from '../SignUp/SignUp';

import UplodeImage from '../../Components/UplodeImage/UplodeImage';
import { MainBtn } from '../Appointment/page';
import PropTypes from 'prop-types';
// import camera from '../../../../public/Images/camera.png';
// import whtcheck from '../../../../public/Images/whtcheck.png';
// import comp from '../../../../public/Images/comp.png';
// import host1 from '../../../../public/Images/host1.png';
// import host2 from '../../../../public/Images/host2.png';
// import whtcloud from '../../../../public/Images/whtcloud.png';
import { BsFileDiffFill } from 'react-icons/bs';
import { AiFillFileImage } from 'react-icons/ai';
import { LoadScript, Autocomplete } from '@react-google-maps/api';

import Swal from 'sweetalert2';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { FaFileWord } from 'react-icons/fa';
import { RxCrossCircled } from 'react-icons/rx';
import { IoIosAddCircle } from 'react-icons/io';
import { Button } from 'react-bootstrap';
const libraries = ['places'];

const SignUpDetails = () => {
  const autoCompleteRef = useRef(null);

  const location = useLocation();
  const cognitoId = location.state?.cognitoId;
  const { userId, refreshProfileData, initializeUser } = useAuth();

  const navigate = useNavigate();
  console.log('userId', userId);
  console.log('cognitoId', cognitoId);
  const [image, setImage] = useState([]);
  const [uploadedfiles, setUploadedFiles] = useState([]);
  console.log('uploadedfiles', uploadedfiles);
  const [preImage, setPreImage] = useState(null);
  const [formData, setFormData] = useState({
    userId: cognitoId || '',
    businessName: '',
    registrationNumber: '',
    yearOfEstablishment: '',
    phoneNumber: '',
    website: '',
    addressLine1: '',
    street: '',
    city: '',
    state: '',
    zipCode: '',
    latitude: '',
    longitude: '',
  });
  console.log(formData);
  useEffect(() => {
    if (userId && userId !== formData.userId) {
      setFormData((prev) => ({
        ...prev,
        userId: userId,
      }));
    }
  }, [userId, formData.userId]);
  // console.log("process.env.GOOGLE_MAPS_API_KEY",process.env.NX_PUBLIC_VITE_BASE_GOOGLE_MAPS_API_KEY);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFile, setSelectedFile] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  console.log('selectedFile', selectedFile);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleImageChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setPreImage(URL.createObjectURL(file));
      setImage(file);
    }
  };

  const servicesList = [
    { code: 'E001', display: '24/7 Emergency Care' },
    { code: 'S001', display: 'Surgery and Operating Rooms' },
    { code: 'V001', display: 'Veterinary ICU' },
    { code: 'D001', display: 'Dental Care Services' },
    { code: 'B001', display: 'Behavioral Therapy' },
  ];
  const [selectedServices, setSelectedServices] = useState([]);
  console.log("selectedServices",selectedServices);

  const [activeModes, setActiveModes] = useState('yes');

  const handleSearch = (event) => {
    setSearchTerm(event.target.value);
  };
  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };
  const handleSelectService = (service) => {
    setSelectedServices((prevSelected) => {
      const isSelected = prevSelected.some((s) => s.code === service.code);
  
      return isSelected
        ? prevSelected.filter((s) => s.code !== service.code) // Remove if already selected
        : [...prevSelected, { code: service.code, display: service.display }];
    });
  };
  const filteredServices = servicesList.filter((service) =>
    service.display.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleModeClick = (mode) => {
    if (activeModes.includes('yes') && activeModes.includes('no')) {
      setActiveModes(mode);
    } else {
      setActiveModes(mode);
    }
  };
  const organizationFHIR = {
    resourceType: "Organization",
    id: formData.userId, // Use `userId` as Organization ID
    identifier: [
      {
        system: "http://example.com/registration",
        value: formData.registrationNumber,
      },
      {
        system: "http://example.com/hospital-id",
        value: formData.userId,
      },
    ],
    name: formData.businessName,
    telecom: [
      {
        system: "phone",
        value: formData.phoneNumber,
        use: "work",
      },
      ...(formData.website
        ? [
            {
              system: "url",
              value: formData.website,
              use: "work",
            },
          ]
        : []),
    ],
    address: [
      {
        line: [formData.addressLine1],
        city: formData.city,
        state: formData.state,
        street: formData.street,
        postalCode: formData.zipCode,
        country: "US", // Default to United States (can be dynamic if needed)
        extension: [
          {
            url: "http://hl7.org/fhir/StructureDefinition/geolocation",
            extension: [
              {
                url: "latitude",
                valueDecimal: parseFloat(formData.latitude) || 0.0,
              },
              {
                url: "longitude",
                valueDecimal: parseFloat(formData.longitude) || 0.0,
              },
            ],
          },
        ],
      },
    ],
    type: [
      {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/organization-type",
            code: "prov",
            display: "Healthcare Provider",
          },
        ],
      },
    ],
    active: formData.activeModes === "true", // Convert string to boolean
  };
  const healthcareServices = selectedServices.map((service) => ({
    resourceType: "HealthcareService",
    providedBy: {
      reference: `Organization/${formData.userId}`, // Reference to the parent Organization
    },
    type: [
      {
        coding: [
          {
            system: "http://example.com/fhir/HealthcareService",
            code: service.code,
            display: service.display,
          },
        ],
      },
    ],
    active: true, // Set services as active by default
  }));
    
  // API Submission
  const handleSubmit = async (event) => {
    event.preventDefault();
  
    // Create FormData to send files and FHIR data
    const formDataToSend = new FormData();
  
    // Attach logo file if provided
    if (image) formDataToSend.append("logo", image);
  
    // Attach documents as actual files
    selectedFile.forEach((file) => {
      formDataToSend.append("attachments", file);
    });
  
    // Prepare final payload for submission
    const fhirData = {
      organization: organizationFHIR, // Organization Resource
      healthcareServices: healthcareServices, // Array of Services
    };
  
    // Add FHIR data to FormData as JSON
    formDataToSend.append("fhirData", JSON.stringify(fhirData));
  
    try {
      // Send data to backend
      const response = await axios.post(
        `${process.env.NX_PUBLIC_VITE_BASE_URL}fhir/organization`,
        formDataToSend
      );
  
      // Handle success
      if (response.status === 200) {
        Swal.fire({
          icon: "success",
          title: "Form submitted successfully!",
          text: "Your profile has been set up successfully.",
        });
  
        // Reset selections and navigate to dashboard
        setSelectedServices([]);
        initializeUser(); // Reset form if needed
        navigate("/dashboard");
        if (formData.userId) refreshProfileData(); // Refresh profile data
      } else {
        Swal.fire({
          icon: "error",
          title: "Failed to submit form!",
          text: "There was an issue while submitting the form. Please try again.",
        });
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "An error occurred while submitting the form.",
      });
    }
  };
  
  
  
  const getProfiledata = useCallback(async () => {
    // console.log("hello");
    try {
      const response = await axios.get(
        `${process.env.NX_PUBLIC_VITE_BASE_URL}api/auth/getProfile/${userId}`
      );

      if (response.data) {
        // console.log("response", response.data);

        const {
          businessName,
          registrationNumber,
          yearOfEstablishment,
          phoneNumber,
          website,
          activeModes,
          address,
          // selectedServices,
          logoUrl,
          prescriptionUploadUrl,
        } = response.data;

        setFormData({
          businessName,
          registrationNumber,
          yearOfEstablishment,
          phoneNumber,
          website,
          addressLine1: address?.addressLine1 || '',
          street: address?.street || '',
          city: address?.city || '',
          state: address?.state || '',
          zipCode: address?.zipCode || '',
        });

        // setSelectedServices(selectedServices || []);
        // setUploadedFiles([logoUrl]);
        setImage(logoUrl || []);
        const updatedDocuments = prescriptionUploadUrl.map((doc) => ({
          _id: doc._id,
          name: doc.name.slice(72),
          type: doc.type,
          date: new Date(doc.date).toLocaleDateString(),
        }));
        setUploadedFiles(updatedDocuments);
        setActiveModes(activeModes || '');
      }
    } catch (error) {
      console.error('Error fetching profile data:', error);
      // Swal.fire({
      //   icon: "error",
      //   title: "Error fetching profile data",
      //   text: "There was an issue fetching your profile data. Please try again.",
      // });
    }
  },[userId]);
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);

    const allowedTypes = [
      'application/pdf', // PDF
      'application/msword', // DOC
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
      'image/jpeg', // JPG
      'image/png', // PNG
      'image/gif', // GIF
      'image/webp', // WebP
      'image/bmp', // BMP
    ];

    const validFiles = files.filter((file) => allowedTypes.includes(file.type));

    if (validFiles.length === 0) {
      alert('Only PDF, DOC, DOCX, and image files are allowed!');
      return;
    }

    const filesWithDate = validFiles.map((file) => ({
      name: file.name,
      type: file.type,
      date: new Date().toLocaleDateString('en-GB'),
    }));

    setUploadedFiles((prev) => [...prev, ...filesWithDate]);

    setSelectedFile((prev) => [...prev, ...validFiles]);
  };

  const removeFile = (fileToRemove) => {
    console.log("hello', fileToRemove", fileToRemove);
    if (fileToRemove._id) {
      // API File: Ask confirmation before deleting
      Swal.fire({
        title: 'Are you sure?',
        text: 'This file is stored on the backend. Deleting it will remove it permanently.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, delete it!',
        cancelButtonText: 'Cancel',
      }).then((result) => {
        if (result.isConfirmed) {
          axios
            .delete(
              `${process.env.NX_PUBLIC_VITE_BASE_URL}api/auth/${userId}/deleteDocumentsToUpdate/${fileToRemove._id}`
            )
            .then(() => {
              setUploadedFiles((prev) =>
                prev.filter((file) => file._id !== fileToRemove._id)
              );
              Swal.fire('Deleted!', 'The file has been deleted.', 'success');
            })
            .catch(() => {
              Swal.fire('Error!', 'Failed to delete the file.', 'error');
            });
        }
      });
    } else {
      setUploadedFiles((prev) => prev.filter((file) => file !== fileToRemove));
      setSelectedFile((prev) =>
        prev.filter((file) => file.name !== fileToRemove.name)
      );
    }
  };

  useEffect(() => {
    if (userId) {
      getProfiledata();
    }
  }, [userId, getProfiledata]);
  
  const extractAddressDetails = (place) => {
    const addressResp = {
      address: '',
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: '',
      lat: place.geometry?.location?.lat(),
      long: place.geometry?.location?.lng(),
    };

    const address_components = place.address_components || [];

    address_components.forEach((component) => {
      const types = component.types;

      if (types.includes('route')) {
        addressResp.street = component.long_name;
      }
      if (types.includes('locality')) {
        addressResp.city = component.long_name;
      }
      if (types.includes('administrative_area_level_1')) {
        addressResp.state = component.short_name;
      }
      if (types.includes('postal_code')) {
        addressResp.zipCode = component.long_name;
      }
      if (types.includes('country')) {
        addressResp.country = component.long_name;
      }
    });

    return addressResp;
  };

  // Handle Place Selection
  const handlePlaceSelect = () => {
    if (autoCompleteRef.current) {
      const place = autoCompleteRef.current.getPlace();
      if (!place || !place.formatted_address) return; // Ensure a valid selection

      const firstPartOfAddress = String(place.formatted_address).split(',')[0]; // Extract first part

      
      const placeDetails = extractAddressDetails(place);
      
      if (placeDetails) {
        setFormData((prevState) => ({
          ...prevState,
          addressLine1: firstPartOfAddress, // Set first part of address
          street: placeDetails.street || '',
          city: placeDetails.city || '',
          state: placeDetails.state || '',
          zipCode: placeDetails.zipCode || '',
          latitude: placeDetails.lat || "",
          longitude: placeDetails.long || "",
        }));
      }
    }
  };

  return (
    <section className="SignDetailsSec">
      <div className="container">
        <div className="mb-3">
          <HeadText Spntext="Set up" blktext="your profile " />
        </div>
        <div className="Sign_Details_Data">
          <div className="LeftProfile">
            <div className="ProfileDiv">
              <form
              //  onSubmit={handleSubmit}
              >
                <div className="add-logo-container">
                  <input
                    type="file"
                    id="logo-upload"
                    accept="image/*"
                    onChange={handleImageChange}
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="logo-upload" className="upload-label">
                    {preImage || image ? (
                      <img
                        src={preImage || image} // This will use preImage if available, otherwise image
                        alt="Preview"
                        className="preview-image"
                      />
                    ) : (
                      <div className="upload-placeholder">
                        <img src={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/camera.png`} alt="camera" className="icon" />
                      </div>
                    )}
                  </label>
                  <h5>Add Logo</h5>
                </div>

                <div className="DetailInput">
                  <Forminput
                    inlabel="Business Name"
                    intype="text"
                    inname="businessName"
                    value={formData.businessName}
                    onChange={handleInputChange}
                  />
                  <div className="row">
                    <div className="col-md-6">
                      <Forminput
                        inlabel="Registration Number"
                        intype="number"
                        inname="registrationNumber"
                        value={formData.registrationNumber}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="col-md-6">
                      <Forminput
                        inlabel="Year of Establishment"
                        intype="number"
                        inname="yearOfEstablishment"
                        value={formData.yearOfEstablishment}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                  <div className="row">
                    <div className="col-md-3">
                      <Forminput
                        inlabel="Phone Number"
                        intype="number"
                        inname="phoneNumber"
                        value={formData.phoneNumber}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="col-md-9">
                      <Forminput
                        inlabel="Website"
                        intype="text"
                        inname="website"
                        value={formData.website}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                  <LoadScript
                    googleMapsApiKey={
                      process.env.NX_PUBLIC_VITE_BASE_GOOGLE_MAPS_API_KEY
                    }
                    libraries={libraries}
                  >
                    <div>
                      <h6>Address</h6>

                      {/* Google Places Autocomplete using Forminput */}
                      <Autocomplete
                        fields={[
                          'geometry',
                          'place_id',
                          'formatted_address',
                          'address_components',
                        ]}
                        onLoad={(ref) => (autoCompleteRef.current = ref)}
                        onPlaceChanged={handlePlaceSelect}
                      >
                        
                        <Forminput
                          inlabel="Address Line 1"
                          intype="text"
                          inname="addressLine1"
                          value={formData.addressLine1}
                          onChange={(e) => {
                            handleInputChange(e); // Allow manual input
                          }}
                          className="form-control"
                          
                        />
                      </Autocomplete>

                      <div className="row">
                        <div className="col-md-6">
                          <Forminput
                            inlabel="Street"
                            intype="text"
                            inname="street"
                            value={formData.street}
                            onChange={handleInputChange}
                          />
                        </div>
                        <div className="col-md-6">
                          <Forminput
                            inlabel="City"
                            intype="text"
                            inname="city"
                            value={formData.city}
                            onChange={handleInputChange}
                          />
                        </div>
                      </div>

                      <div className="row">
                        <div className="col-md-6">
                          <Forminput
                            inlabel="State"
                            intype="text"
                            inname="state"
                            value={formData.state}
                            onChange={handleInputChange}
                          />
                        </div>
                        <div className="col-md-6">
                          <Forminput
                            inlabel="ZIP Code"
                            intype="number"
                            inname="zipCode"
                            value={formData.zipCode}
                            onChange={handleInputChange}
                          />
                        </div>
                      </div>
                    </div>
                  </LoadScript>

                  {/* <div className="service-options-container">
                      <div className="service-group">
                        <label className="service-label">
                          Emergency Services
                        </label>
                        <input
                          type="radio"
                          name="emergencyServices"
                          value="Yes"
                          checked={services.emergencyServices === "Yes"}
                          onChange={handleChange}
                          id="emergency-yes"
                        />
                        <label htmlFor="emergency-yes" className="radio-label">
                          Yes
                        </label>
                        <input
                          type="radio"
                          name="emergencyServices"
                          value="No"
                          checked={services.emergencyServices === "No"}
                          onChange={handleChange}
                          id="emergency-no"
                        />
                        <label htmlFor="emergency-no" className="radio-label">
                          No
                        </label>
                      </div>

                      <div className="service-group">
                        <label className="service-label">
                          Cashless Facility
                        </label>
                        <input
                          type="radio"
                          name="cashlessFacility"
                          value="Yes"
                          checked={services.cashlessFacility === "Yes"}
                          onChange={handleChange}
                          id="cashless-yes"
                        />
                        <label htmlFor="cashless-yes" className="radio-label">
                          Yes
                        </label>
                        <input
                          type="radio"
                          name="cashlessFacility"
                          value="No"
                          checked={services.cashlessFacility === "No"}
                          onChange={handleChange}
                          id="cashless-no"
                        />
                        <label htmlFor="cashless-no" className="radio-label">
                          No
                        </label>
                      </div>

                      <div className="service-group">
                        <label className="service-label">24/7 Services</label>
                        <input
                          type="radio"
                          name="services24x7"
                          value="Yes"
                          checked={services.services24x7 === "Yes"}
                          onChange={handleChange}
                          id="services-yes"
                        />
                        <label htmlFor="services-yes" className="radio-label">
                          Yes
                        </label>
                        <input
                          type="radio"
                          name="services24x7"
                          value="No"
                          checked={services.services24x7 === "No"}
                          onChange={handleChange}
                          id="services-no"
                        />
                        <label htmlFor="services-no" className="radio-label">
                          No
                        </label>
                      </div>
                    </div> */}
                </div>

                <div className="sddsd">
                  <h6>Does your business have specialized departments?</h6>
                  <div className="ConstModeUl">
                    <ul>
                      <li
                        className={activeModes === 'yes' ? 'active' : ''}
                        onClick={() => handleModeClick('yes')}
                      >
                        Yes
                      </li>
                      <li
                        className={activeModes === 'no' ? 'active' : ''}
                        onClick={() => handleModeClick('no')}
                      >
                        No
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="services_dropdown">
                  <div
                    className={`ServHeadr ${isDropdownOpen ? 'open' : ''}`}
                    onClick={toggleDropdown}
                  >
                    <span>Add Services</span>
                    <span className="arrow">{isDropdownOpen ? '▲' : '▼'}</span>
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
                                ? 'selected'
                                : ''
                            }`}
                          >
                            <label>
                              <input
                                type="checkbox"
                                className="form-check-input"
                                checked={selectedServices.some((s) => s.code === service.code)}
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

                <UplodeImage
                  selectedFile={selectedFile}
                  onFileChange={handleFileChange}
                />

                <div className="DoctProfpdf">
                  <h5>Uploaded Documents</h5>
                  <div className="PdfUpldpf">
                    <div className="uploaded_files">
                      {uploadedfiles.map((file, index) => {
                        // Handle files properly (old API files have type as string, new ones are File objects)
                        let fileType =
                          file.type ||
                          (file.name.includes('.')
                            ? `.${file.name.split('.').pop()}`
                            : '');

                        return (
                          <div key={index} className="file-item">
                            {/* Ensure fileType exists before calling startsWith */}
                            {fileType.startsWith('image/') ? (
                              <AiFillFileImage />
                            ) : fileType === 'application/pdf' ? (
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
                                {file.date || new Date().toLocaleDateString()}
                              </span>
                            </div>

                            <Button onClick={() => removeFile(file)}>
                              <RxCrossCircled />
                            </Button>
                          </div>
                        );
                      })}
                    </div>

                    <div className="pdfUpldeButton">
                      <label htmlFor="file-upload" className="upload-btn">
                        <IoIosAddCircle /> Upload
                      </label>
                      <input
                        type="file"
                        id="file-upload"
                        accept=".pdf,.doc,.docx,image/*" // Allow PDF, DOC, DOCX, and images
                        multiple
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                      />
                    </div>
                  </div>
                </div>

                {selectedFile && (
                  <div>
                    {typeof selectedFile === 'object' &&
                    selectedFile instanceof Blob ? (
                      <>
                        <h3>Selected File:</h3>
                        <p>File Name: {selectedFile.name}</p>
                        <p>File Type: {selectedFile.type}</p>
                        <p>File Size: {selectedFile.size} bytes</p>
                      </>
                    ) : (
                      <p></p>
                    )}
                  </div>
                )}

                <MainBtn
                  bimg={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/whtcheck.png`}
                  // btext="submit"
                  optclas=""
                  // mdtarget="#ProfModal"
                  btntyp="submit"
                  onClick={handleSubmit}
                />
                {/* <ProfileModal /> */}
              </form>
            </div>
          </div>{' '}
          <div className="rightProfile">
            <ProfileProg blname="Profile" spname="Progress" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default SignUpDetails;

ProfileProg.propTypes = {
  blname: PropTypes.string.isRequired,
  spname: PropTypes.string.isRequired,
};
export function ProfileProg({ blname, spname }) {
  return (
    <div className="profProgressDiv">
      <div className="Prof">
        <div className="profileText">
          <h4>
            {blname} <span> {spname}</span>
          </h4>
        </div>
        <div className="ProgDiv">
          <div className="progress-bar">
            <span className="progress-fill" style={{ width: '48%' }}></span>
          </div>
          <p className="progress-text">
            48% <span>Complete</span>
          </p>
        </div>
      </div>
      <div className="Profcomp">
        <button className="complete-button">
          {' '}
          <img src={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/comp.png`} alt="" /> Complete Later{' '}
        </button>
      </div>
    </div>
  );
}

export function ProfileModal() {
  const [selectedOption, setSelectedOption] = useState(null);

  const handleSelect = (option) => {
    setSelectedOption(option);
  };

  return (
    <div className="ProfileDetailModal">
      <div
        className="modal fade"
        id="ProfModal"
        tabIndex="-1"
        aria-labelledby="DashModalLabel"
        aria-hidden="true"
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="Profile-content">
              <div className="modltoptext">
                <h3>Would You Like to Host Your PIMS?</h3>
                <p>Choose your hosting preference to get started.</p>
              </div>

              <div className="hosting-options">
                <div
                  className={`option-card ${
                    selectedOption === 'cloud' ? 'active' : ''
                  }`}
                  onClick={() => handleSelect('cloud')}
                >
                  <img src={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/host1.png`} alt="Cloud Hosting" />
                  <h5>Cloud Hosting</h5>
                  <p>
                    Enjoy secure, hassle-free hosting on our cloud with
                    automatic updates, backups, and 24/7 support.
                  </p>
                </div>

                <div
                  className={`option-card ${
                    selectedOption === 'self' ? 'active' : ''
                  }`}
                  onClick={() => handleSelect('self')}
                >
                  <img src={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/host2.png`} alt="Self Hosting" />
                  <h5>Self-Hosting</h5>
                  <p>
                    Host on your own infrastructure for complete control and
                    customization. We&apos;ll provide setup support.
                  </p>
                </div>
              </div>

              <div className="profmdbtn">
                <MainBtn
                  bimg={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/whtcloud.png`}
                  btext="Choose Cloud Hosting"
                  optclas=""
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
