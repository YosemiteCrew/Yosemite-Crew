// eslint-disable-next-line no-unused-vars
import React, { useEffect, useState } from 'react';
import './Add_Vet.css';
import { Forminput, FormPassw, HeadText } from '../SignUp/SignUp';
import camera from '../../../../public/Images/camera.png';
import { ProfileProg } from '../SignUpDetails/SignUpDetails';
import { Col, Form, Row } from 'react-bootstrap';
// import UplodeImage from '../../Components/UplodeImage/UplodeImage';
import DynamicSelect from '../../Components/DynamicSelect/DynamicSelect';
import OperatingHours from '../../Components/OperatingHours/OperatingHours';
import { Modal, Button } from 'react-bootstrap';
import Switch from 'react-switch';
import { MainBtn } from '../Appointment/page';
import whtcheck from '../../../../public/Images/whtcheck.png';
// import { MdOpacity } from 'react-icons/md';
import axios from 'axios';
import DynamicDatePicker from '../../Components/DynamicDatePicker/DynamicDatePicker';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import { AiFillFileImage } from 'react-icons/ai';
import { BsFileDiffFill } from 'react-icons/bs';
import { FaFileWord } from 'react-icons/fa';
import { RxCrossCircled } from 'react-icons/rx';
import { IoIosAddCircle } from 'react-icons/io';
import { useAuth } from '../../context/useAuth';
import countrycode from '../Add_Department/countriescities.json';

const Add_Vet = () => {
  const { userId ,onLogout} = useAuth();
  const navigate = useNavigate();
  const [OperatingHour, setOperatingHours] = useState([]);
  const [uploadedfiles, setUploadedFiles] = useState([]);
  // const [selectedCode, setSelectedCode] = useState('+91');
  const [searchTerms, setSearchTerms] = useState('');
  const [PersonalInfoForm, setPersonalInfoForm] = useState({
    firstName: '',
    lastName: '',
    gender: '',
    email: '',
    countrycode: '+91',
    phone: '',
    dateOfBirth: '',
  });
  // console.log('PersonalInfoForm.dateOfBirth', PersonalInfoForm.countrycode);

  const [ResidentialAddressForm, setResidentialAddressForm] = useState({
    addressLine1: '',
    city: '',
    stateProvince: '',
    country: '',
    zipCode: '',
  });
  const [professionalBackground, setProfessionalBackground] = useState({
    specialization: '',
    qualification: '',
    medicalLicenseNumber: '',
    yearsOfExperience: '',
    languagesSpoken: '',
    biography: '',
    document: [],
  });
  // console.log(professionalBackground.specialization);

  // const [selectedFile, setSelectedFile] = useState(null);
  const [consultFee, setConsultFee] = useState('');
  const [CreateLogin, setCreateLogin] = useState({
    username: '',
    password: '',
    confirmPassword: '',
  });
  const [authSettings, setAuthSettings] = useState({
    takeAssessments: false,
    appointments: false,
    viewMedicalRecords: false,
    prescribeMedications: false,
  });
  const [options, setOptions] = useState([]);
  const [timeDuration, setTimeDuration] = useState(null);

  // Filter countries based on search input
  const filteredCountries = countrycode.filter(
    (country) =>
      country.countryCode.includes(searchTerms) ||
      country.label.toLowerCase().includes(searchTerms.toLowerCase())
  );

  const handleDateChange = (date) => {
    setPersonalInfoForm((pre) => ({
      ...pre,
      dateOfBirth: date,
    })); // Update the parent state with the selected date
  };

  const getSpecilization = async () => {
    try {
      const token = sessionStorage.getItem("token");
      const response = await axios.get(
        `${process.env.NX_PUBLIC_VITE_BASE_URL}api/auth/getAddDepartment?userId=${userId}`,{headers:{Authorization:`Bearer ${token}`}}
      );
      const departmentOptions = response.data.map((department) => ({
        value: department._id,
        label: department.departmentName,
      }));
      setOptions(departmentOptions);
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('Session expired. Redirecting to signin...');
        onLogout(navigate);
      }
    }
  };
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
    console.log('filesWithDate', filesWithDate);
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
  // console.log("professionalBackground", professionalBackground);

  useEffect(() => {
    getSpecilization();
  }, [userId]);

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

  // Handle residential address input change
  const handleAddressInputChange = (e) => {
    const { name, value } = e.target;
    setResidentialAddressForm((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  // Handle personal information form input change
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setPersonalInfoForm((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  // Handle personal info click action
  const handleClick = (field, value) => {
    setPersonalInfoForm((prevData) => ({
      ...prevData,
      [field]: value,
    }));
  };

  // Profile image upload handler
  const [image, setImage] = useState(null);
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
    }
  };

  // Toggle handlers
  const [isToggled, setIsToggled] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleToggle = (checked) => {
    setIsToggled(checked);
    if (checked) {
      setIsModalOpen(true);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  // Operating hours handler
  const handleSaveOperatingHours = (updatedHours) => {
    setOperatingHours(updatedHours);
    // console.log('Received operating hours:', updatedHours);
  };

  // Consultation mode handling
  const [activeModes, setActiveModes] = useState(['In-person']);
  const handleModeClick = (mode) => {
    if (mode === 'Both') {
      setActiveModes(['In-person', 'Online']);
    } else if (
      activeModes.includes('In-person') &&
      activeModes.includes('Online')
    ) {
      setActiveModes([mode]);
    } else {
      setActiveModes([mode]);
    }
  };

  const handleFeeChange = (e) => {
    setConsultFee(e.target.value);
  };

  const [error, setError] = useState(''); // For validation errors

  // Create login handler
  const handleCreateLogin = (e) => {
    const { name, value } = e.target;
    setCreateLogin((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  // Handle switch toggle changes for authorization settings
  const handleSwitchChange = (e) => {
    const { id, checked } = e.target;
    setAuthSettings((prevSettings) => ({
      ...prevSettings,
      [id]: checked,
    }));
  };

  // Select options
  const handleDynamicChange = (value) => {
    setTimeDuration(value);
  };

  const HandleSubmit = async () => {
    // 1. Validate input data
    if (
      !PersonalInfoForm.firstName ||
      !PersonalInfoForm.lastName ||
      !PersonalInfoForm.email ||
      !PersonalInfoForm.phone
    ) {
      Swal.fire({
        icon: 'error',
        title: 'Missing Information',
        text: 'Please fill in all required personal information fields.',
      });
      return;
    }

    if (CreateLogin.password !== CreateLogin.confirmPassword) {
      Swal.fire({
        icon: 'error',
        title: 'Password Mismatch',
        text: 'Passwords do not match.',
      });
      return;
    }

    if (!CreateLogin.username) {
      Swal.fire({
        icon: 'error',
        title: 'Username Required',
        text: 'Please provide a username.',
      });
      return;
    }

    const formData = new FormData();

    professionalBackground.document.forEach((file) => {
      formData.append('document', file);
    });
    if (image) {
      formData.append('image', image);
    }

    formData.append(
      'formData',
      JSON.stringify({
        personalInfo: PersonalInfoForm,
        residentialAddress: ResidentialAddressForm,
        professionalBackground: professionalBackground,
        availability: OperatingHour,
        activeModes: activeModes,
        consultFee: consultFee,
        loginCredentials: CreateLogin,
        authSettings: authSettings,
        timeDuration: timeDuration,
        bussinessId: userId,
      })
    );
    const token = sessionStorage.getItem('token');

    try {
      const response = await fetch(
        `${process.env.NX_PUBLIC_VITE_BASE_URL}api/doctors/add-doctors`,
        {
          method: 'POST',
          body: formData,
          headers: {
            Authorization: `Bearer ${token}`, // Attach the token to the request headers
          },
        },
        
      );

      if (response.ok) {
        Swal.fire({
          icon: 'success',
          title: 'Success',
          text: 'Form submitted successfully!',
        });
        navigate('/addoctor');
        // Reset forms and other states
        // setPersonalInfoForm({
        //   firstName: "",
        //   lastName: "",
        //   gender: "",
        //   email: "",
        //   phone: "",
        //   image: "",
        // });
        // setResidentialAddressForm({
        //   addressLine1: "",
        //   city: "",
        //   stateProvince: "",
        //   country: "",
        //   zipCode: "",
        // });
        // setProfessionalBackground({
        //   specialization: "",
        //   qualification: "",
        //   medicalLicenseNumber: "",
        //   yearsOfExperience: "",
        //   languagesSpoken: "",
        //   biography: "",
        //   image: "",
        // });
        // setCreateLogin({
        //   username: "",
        //   password: "",const [uploadedfiles, setUploadedFiles] = useState([]);
        // });
        // setAuthSettings({
        //   takeAssessments: false,
        //   appointments: false,
        //   viewMedicalRecords: false,
        //   prescribeMedications: false,
        // });
      } else {
        const errorData = await response.json();
        if (error.response && error.response.status === 401) {
          console.log('Session expired. Redirecting to signin...');
          onLogout(navigate);
        }
        Swal.fire({
          icon: 'error',
          title: 'Submission Failed',
          text:
            errorData.message ||
            'An error occurred while submitting the form. Please try again.',
        });
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to submit the form. Please try again later.',
      });
      console.error('Submission Error:', error);
    }
  };
  const duration = [
    { value: '15', label: '15 mins' },
    { value: '30', label: '30 mins' },
    { value: '60', label: '1 hour' },
    { value: '120', label: '2 hours' },
  ];
  return (
    <section className="ProfileSec">
      <div className="container">
        <div className="mb-3">
          <HeadText Spntext="Add" blktext="a vet " />
        </div>

        <div className="Add_Profile_Data">
          <div className="LeftProfileDiv">
            <Form>
              <div className="PersonlInfoDiv">
                <div className="perInfo">
                  <h6>Personal Information</h6>
                  <div className="add-logo-container">
                    <input
                      type="file"
                      id="logo-upload"
                      accept="image/*"
                      onChange={handleImageChange}
                      style={{ display: 'none' }}
                    />
                    <label htmlFor="logo-upload" className="upload-label">
                      {image ? (
                        <img
                          src={URL.createObjectURL(image)}
                          alt="Preview"
                          className="preview-image"
                        />
                      ) : (
                        <div className="upload-placeholder">
                          <img src={camera} alt="camera" className="icon" />
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
                        {['Male', 'Female', 'Other'].map((gender) => (
                          <li
                            key={gender}
                            className={
                              PersonalInfoForm.gender === gender ? 'active' : ''
                            }
                            onClick={() => handleClick('gender', gender)}
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
                    <div className="ff">
                      <input
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
                      </select>
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
                      value={professionalBackground.medicalLicenseNumber}
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

                {/* <UplodeImage onFileChange={handleFileChange} /> */}

                <div className="DoctProfpdf">
                  <h5>Uploaded Documents</h5>
                  <div className="PdfUpldpf">
                    <div className="uploaded_files">
                      {uploadedfiles?.map((file, index) => (
                        <div key={index} className="file-item">
                          {/* Display icons based on file type */}
                          {file.type.startsWith('image/') ? (
                            <AiFillFileImage />
                          ) : file.type === 'application/pdf' ? (
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
                            <span className="file-date">{file.date}</span>
                          </div>
                          <button onClick={() => removeFile(index)}>
                            <RxCrossCircled />
                          </button>
                        </div>
                      ))}
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

                {/* {selectedFile && (
                    <div>
                      <h3>Selected File:</h3>
                      <p>File Name: {selectedFile.name}</p>
                      <p>File Type: {selectedFile.type}</p>
                      <p>File Size: {selectedFile.size} bytes</p>
                    </div>
                  )} */}
              </div>

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
                      <span>{isToggled ? 'On' : 'Off'}</span>
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
                          The toggle is turned on. You can add more content
                          here.
                        </p>
                      </Modal.Body>
                      <Modal.Footer>
                        <Button variant="secondary" onClick={closeModal}>
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
                          activeModes.includes('In-person') ? 'active' : ''
                        }
                        onClick={() => handleModeClick('In-person')}
                      >
                        In-person
                      </li>
                      <li
                        className={
                          activeModes.includes('Online') ? 'active' : ''
                        }
                        onClick={() => handleModeClick('Online')}
                      >
                        Online
                      </li>
                      <li
                        className={
                          activeModes.includes('In-person') &&
                          activeModes.includes('Online')
                            ? 'active'
                            : ''
                        }
                        onClick={() => handleModeClick('Both')}
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
                {error && <p className="error-message">{error}</p>}
              </div>

              <div className="AuthrizDiv">
                <h6>Authorization Settings</h6>
                <div className="AuthrzData">
                  {/* Take Assessments */}
                  <div className="Authitems">
                    <div className="lftauth">
                      <h6>Take Assessments</h6>
                      <p>Allow this vet to conduct assessments for pets.</p>
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
                        Grant access to the pet’s medical history and records.
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
                        Allow the vet to issue prescriptions for treatments.
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
                <label className="form-check-label" htmlFor="exampleCheck1">
                  I agree to Yosemite Crew’s <span>Terms and Conditions</span>{' '}
                  and <span>Privacy Policy</span>
                </label>
              </div>

              <MainBtn
                btntyp="button"
                bimg={whtcheck}
                btext="Add Vet"
                optclas="opt5"
                onClick={() => {
                  HandleSubmit();
                }}
              />
            </Form>
          </div>

          <div className="RytProfileDiv">
            <ProfileProg blname="Profile" spname="Progress" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default Add_Vet;
