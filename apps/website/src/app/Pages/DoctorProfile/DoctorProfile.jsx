// eslint-disable-next-line no-unused-vars
import React, { useEffect, useState } from 'react';
import './DoctorProfile.css';
import PropTypes from 'prop-types';
import { Button, Col, Container, Form, Row } from 'react-bootstrap';
import whtcheck from '../../../../public/Images/whtcheck.png';
import { Link, useNavigate } from 'react-router-dom';
import { FiEdit3 } from 'react-icons/fi';
import doctprofile from '../../../../public/Images/doctprofile.png';
import { IoIosAddCircle } from 'react-icons/io';
import { BsFileDiffFill } from 'react-icons/bs';
import { AiFillFileImage } from 'react-icons/ai';
import { RxCrossCircled } from 'react-icons/rx';
import Modal from 'react-bootstrap/Modal';
import camera from '../../../../public/Images/camera.png';
import { Forminput } from '../SignUp/SignUp';
import DynamicDatePicker from '../../Components/DynamicDatePicker/DynamicDatePicker';
import axios from 'axios';
import { FaFileWord } from 'react-icons/fa';
import { MainBtn } from '../Appointment/page';
import Swal from 'sweetalert2';
import { useAuth } from '../../context/useAuth';

function DoctorProfile() {
  const { doctorProfile, userId } = useAuth();
  const navigate = useNavigate();

  const [modalShow, setModalShow] = useState(false);
  const [modalShow1, setModal1Show] = useState(false);
  const [modalShow2, setModal2Show] = useState(false);
  const [uploadedfiles, setUploadedFiles] = useState([]);
  const [personalInfo, setPersonalInfo] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    image: '',
    gender: '',
    dateOfBirth: '',
  });
  console.log('personalInfo', uploadedfiles);
  const [residentialAddress, setResidentialAddress] = useState({
    addressLine1: '',
    city: '',
    stateProvince: '',
    country: '',
    zipCode: '',
  });
  const [professionalBackground, setProfessionalBackground] = useState({
    qualification: '',
    specialization: '',
    medicalLicenseNumber: '',
    yearsOfExperience: '',
    languagesSpoken: '',
    biography: '',
    document: [],
  });
  console.log(
    'professionalBackground.document',
    professionalBackground.document
  );
  useEffect(() => {
    if (doctorProfile) {
      setPersonalInfo({
        firstName: doctorProfile?.personalInfo?.firstName || '',
        lastName: doctorProfile?.personalInfo?.lastName || '',
        email: doctorProfile?.personalInfo?.email || '',
        phone: doctorProfile?.personalInfo?.phone || '',
        image: doctorProfile?.personalInfo?.image || '',
        gender: doctorProfile?.personalInfo?.gender || '',
        dateOfBirth: doctorProfile?.personalInfo?.dateOfBirth || '',
      });

      // Update residentialAddress
      setResidentialAddress({
        addressLine1: doctorProfile?.residentialAddress?.addressLine1 || '',
        city: doctorProfile?.residentialAddress?.city || '',
        stateProvince: doctorProfile?.residentialAddress?.stateProvince || '',
        country: doctorProfile?.residentialAddress?.country || '',
        zipCode: doctorProfile?.residentialAddress?.zipCode || '',
      });

      // Update professionalBackground
      setProfessionalBackground({
        qualification:
          doctorProfile?.professionalBackground?.qualification || '',
        specialization:
          doctorProfile?.professionalBackground?.specialization || '',
        medicalLicenseNumber:
          doctorProfile?.professionalBackground?.medicalLicenseNumber || '',
        yearsOfExperience:
          doctorProfile?.professionalBackground?.yearsOfExperience || '',
        languagesSpoken:
          doctorProfile?.professionalBackground?.languagesSpoken || '',
        biography: doctorProfile?.professionalBackground?.biography || '',
        document: doctorProfile?.professionalBackground?.document || [],
      });
    }

    if (doctorProfile?.documents.length > 0) {
      const updatedDocuments = doctorProfile.documents.map((doc) => ({
        _id: doc._id,
        name: doc.name.slice(75),
        type: doc.type,
        date: new Date(doc.date).toLocaleDateString(),
      }));

      setUploadedFiles(updatedDocuments);
      console.log('updatedDocuments', updatedDocuments);
    }
  }, [doctorProfile]);

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

    setProfessionalBackground((prev) => ({
      ...prev,
      document: [...prev.document, ...validFiles],
    }));
  };

  const removeFile = (index) => {
    setUploadedFiles((prevFiles) => {
      const fileToRemove = prevFiles[index];
      console.log('fileToRemove', fileToRemove);

      if (fileToRemove._id) {
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
                `${process.env.NX_PUBLIC_VITE_BASE_URL}api/doctors/${userId}/documents/${fileToRemove._id}`
              )
              .then(() => {
                setUploadedFiles((prev) =>
                  prev.filter((_, fileIndex) => fileIndex !== index)
                );

                setProfessionalBackground((prev) => ({
                  ...prev,
                  document: prev.document.filter(
                    (_, fileIndex) => fileIndex !== index
                  ),
                }));

                Swal.fire('Deleted!', 'The file has been deleted.', 'success');
              })
              .catch(() => {
                Swal.fire('Error!', 'Failed to delete the file.', 'error');
              });
          }
        });
      } else {
        // Remove local files directly
        setUploadedFiles((prev) =>
          prev.filter((_, fileIndex) => fileIndex !== index)
        );

        setProfessionalBackground((prev) => ({
          ...prev,
          document: prev.document.filter((_, fileIndex) => fileIndex !== index),
        }));
      }

      return prevFiles; // Return unchanged state for SweetAlert handling
    });
  };

  // console.log("professionalBackground", professionalBackground);

  const updateProfileWithFiles = async () => {
    const formData = new FormData();
    if (personalInfo.image) {
      formData.append('image', personalInfo.image);
    }
    // Documents (files)
    professionalBackground.document.forEach((file) => {
      formData.append('document', file);
    });
    formData.append(
      'formData',
      JSON.stringify({
        personalInfo: personalInfo,
        residentialAddress: residentialAddress,
        professionalBackground: professionalBackground,
      })
    );
    try {
      const response = await axios.put(
        `${process.env.NX_PUBLIC_VITE_BASE_URL}api/doctors/updateProfile/${userId}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            // Add any necessary authorization headers, like a JWT token, if needed
            // Authorization: `Bearer ${authToken}`,
          },
        }
      );

      if (response.status === 200) {
        // Success Alert
        Swal.fire({
          icon: 'success',
          title: 'Success',
          text: 'Profile updated successfully!',
        });
        // Optionally navigate to another page, or reset the form
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to update the profile. Please try again later.',
      });
    }
  };

  return (
    <>
      <section className="DoctorProfileSec">
        <Container>
          <div className="DoctProfileMain">
            <div className="PrileDoctHead">
              <h3>Profile Settings</h3>
            </div>

            <div className="DoctProfileData">
              <div className="DoctProfItems">
                <div className="PerInfoHead">
                  <h5>Personal Information</h5>
                  <Link to="#" onClick={() => setModalShow(true)}>
                    <FiEdit3 /> Edit
                  </Link>
                  <PersonalInfo
                    show={modalShow}
                    onHide={() => setModalShow(false)}
                    personalInfo={personalInfo}
                    setPersonalInfo={setPersonalInfo}
                  />
                </div>
                <div className="DoctProfDiv">
                  <img
                    src={
                      personalInfo.image
                        ? personalInfo.image instanceof File
                          ? URL.createObjectURL(personalInfo.image)
                          : personalInfo.image
                        : doctprofile
                    }
                    alt="Profile"
                  />

                  <div className="DoctProfText">
                    <h4>
                      {personalInfo.firstName} {personalInfo.lastName}
                    </h4>
                    <h6>{professionalBackground.specialization}</h6>
                  </div>
                </div>
                <div className="ProfPersnlInfo">
                  <div className="ThreeGridProf">
                    <InfoDiv
                      infpara="First Name"
                      infhed={personalInfo.firstName}
                    />
                    <InfoDiv
                      infpara="Last Name"
                      infhed={personalInfo.lastName}
                    />
                    <InfoDiv infpara="Gender" infhed={personalInfo.gender} />
                  </div>
                  <div className="ThreeGridProf">
                    <InfoDiv
                      infpara="Date of Birth"
                      infhed={personalInfo.dateOfBirth}
                    />
                    <InfoDiv
                      infpara="Email Address"
                      infhed={personalInfo.email}
                    />
                    <InfoDiv
                      infpara="Phone Number"
                      infhed={personalInfo.phone}
                    />
                  </div>
                </div>
              </div>

              <div className="DoctProfItems">
                <div className="PerInfoHead">
                  <h5>Residential Address</h5>
                  <Link to="#" onClick={() => setModal1Show(true)}>
                    <FiEdit3 /> Edit
                  </Link>
                  <ResidentalAdrss
                    show={modalShow1}
                    onHide={() => setModal1Show(false)}
                    address={residentialAddress}
                    setResidentialAddress={setResidentialAddress}
                  />
                </div>
                <div className="ProfPersnlInfo">
                  <div className="ThreeGridProf">
                    <InfoDiv
                      infpara="Address Line 1"
                      infhed={residentialAddress.addressLine1}
                    />
                    <InfoDiv infpara="City" infhed={residentialAddress.city} />
                    <InfoDiv
                      infpara="State/ Province"
                      infhed={residentialAddress.stateProvince}
                    />
                  </div>
                  <div className="ThreeGridProf">
                    <InfoDiv
                      infpara="Country"
                      infhed={residentialAddress.country}
                    />
                    <InfoDiv
                      infpara="ZIP Code"
                      infhed={residentialAddress.zipCode}
                    />
                  </div>
                </div>
              </div>

              <div className="DoctProfItems">
                <div className="PerInfoHead">
                  <h5>Professional Background</h5>
                  <Link to="#" onClick={() => setModal2Show(true)}>
                    <FiEdit3 /> Edit
                  </Link>
                  <Professionalbackground
                    show={modalShow2}
                    onHide={() => setModal2Show(false)}
                    professionalInfo={professionalBackground}
                    setProfessionalBackground={setProfessionalBackground}
                  />
                </div>
                <div className="ProfPersnlInfo">
                  <div className="ThreeGridProf">
                    <InfoDiv
                      infpara="Qualification"
                      infhed={professionalBackground.qualification}
                    />
                    <InfoDiv
                      infpara="Medical License Number"
                      infhed={professionalBackground.medicalLicenseNumber}
                    />
                    <InfoDiv
                      infpara="Years of Experience"
                      infhed={professionalBackground.yearsOfExperience}
                    />
                  </div>
                  <div className="TwoGridProf">
                    <InfoDiv
                      infpara="Languages Spoken"
                      infhed={professionalBackground.languagesSpoken}
                    />
                    <InfoDiv
                      infpara="Biography/ Short Description"
                      infhed={professionalBackground.biography}
                    />
                  </div>

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
                </div>
              </div>

              <MainBtn
                btntyp="button"
                bimg={whtcheck}
                btext="Update Profile"
                optclas=""
                onClick={() => updateProfileWithFiles()}
              />
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}

// Personal Info Modal
function PersonalInfo({ show, onHide, personalInfo, setPersonalInfo }) {
  // const [selectedType, setSelectedType] = useState(personalInfo.gender || "");
  const [image, setImage] = useState(null);
  // console.log("selectedType", selectedType);

  const handleImageChange = (e) => {
    const { name, files } = e.target;
    console.log('e.target.files[0]', files[0]);
    console.log('e.target.name', name);

    if (files && files.length > 0) {
      setImage(files[0]);
      setPersonalInfo((prev) => ({
        ...prev,
        [name]: files[0],
      }));
    }
  };
  const businessTypes = ['Male', 'Female', 'Others'];
  const handleSelectType = (type) => {
    // setPersonalInfo(type); // Update the selected type
    setPersonalInfo((prev) => ({
      ...prev,
      gender: type,
    }));
  };
  const handleChange = (e) => {
    const { name, value } = e.target;
    setPersonalInfo((prev) => ({ ...prev, [name]: value }));
  };
  return (
    <Modal
      show={show}
      onHide={onHide}
      className="PersnlModl"
      size="lg"
      aria-labelledby="contained-modal-title-vcenter"
      centered
    >
      <Modal.Header closeButton>
        <Modal.Title id="contained-modal-title-vcenter">
          Personal Information
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="PersonalInfoDiv">
          <Form>
            <div className="add-logo-container">
              <input
                type="file"
                id="logo-upload"
                accept="image/*"
                name="image"
                onChange={handleImageChange}
                style={{ display: 'none' }}
              />
              <label
                htmlFor="logo-upload"
                className="upload-label"
                style={{ flexDirection: 'row', gap: '10px' }}
              >
                {image ? (
                  <img
                    src={URL.createObjectURL(image)}
                    alt="Preview"
                    className="preview-image"
                  />
                ) : (
                  <div className="upload-placeholder">
                    <img
                      src={personalInfo.image ? personalInfo.image : camera}
                      alt="camera"
                      className="icon"
                    />
                  </div>
                )}
                <h5>Change Profile Picture</h5>
              </label>
            </div>
            <Row>
              <Col md={6}>
                <Forminput
                  inlabel="First Name"
                  intype="text"
                  inname="firstName"
                  value={personalInfo.firstName}
                  onChange={handleChange}
                />
              </Col>
              <Col md={6}>
                <Forminput
                  inlabel="Last Name"
                  intype="text"
                  inname="lastName"
                  value={personalInfo.lastName}
                  onChange={handleChange}
                />
              </Col>
            </Row>
            <Row>
              <Col md={6}>
                <div className="business-type-container Doctmodlgen">
                  <p>Gender</p>
                  <div className="button-group">
                    <ul>
                      {businessTypes.map((type) => (
                        <li
                          key={type}
                          className={`business-button ${
                            personalInfo.gender === type ? 'selected' : ''
                          }`}
                          onClick={() => handleSelectType(type)}
                        >
                          {type}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Col>
              <Col md={6}>
                <DynamicDatePicker
                  placeholder="Date of Birth"
                  value={personalInfo.dateOfBirth} // Pass initial value
                  onDateChange={(date) =>
                    setPersonalInfo((prev) => ({
                      ...prev,
                      dateOfBirth: date,
                    }))
                  }
                />
              </Col>
            </Row>
            <Row>
              <Col md={6}>
                <Forminput
                  inlabel="Email Address"
                  intype="email"
                  inname="email"
                  value={personalInfo.email}
                  onChange={handleChange}
                />
              </Col>
              <Col md={6}>
                <Forminput
                  inlabel="Phone Number"
                  intype="number"
                  inname="phone"
                  value={personalInfo.phone}
                  onChange={handleChange}
                />
              </Col>
            </Row>

            <div className="ModUpldbtn">
              <Button onClick={onHide}>Update</Button>
            </div>
          </Form>
        </div>
      </Modal.Body>
    </Modal>
  );
}

// Residential Address Modal
function ResidentalAdrss({ show, onHide, address, setResidentialAddress }) {
  const handlechange = (e) => {
    setResidentialAddress({ ...address, [e.target.name]: e.target.value });
  };
  return (
    <Modal
      show={show}
      onHide={onHide}
      className="PersnlModl"
      size="lg"
      aria-labelledby="contained-modal-title-vcenter"
      centered
    >
      <Modal.Header closeButton>
        <Modal.Title id="contained-modal-title-vcenter">
          Residential Address
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="PersonalInfoDiv">
          <Form>
            <Row>
              <Col md={8}>
                <Forminput
                  inlabel="Address"
                  intype="text"
                  inname="addressLine1"
                  value={address.addressLine1}
                  onChange={handlechange}
                />
              </Col>
              <Col md={4}>
                <Forminput
                  inlabel="Country"
                  intype="text"
                  inname="country"
                  value={address.country}
                  onChange={handlechange}
                />
              </Col>
            </Row>

            <Row>
              <Col md={4}>
                <Forminput
                  inlabel="State/ Province"
                  intype="text"
                  inname="stateProvince"
                  value={address.stateProvince}
                  onChange={handlechange}
                />
              </Col>
              <Col md={4}>
                <Forminput
                  inlabel="City"
                  intype="text"
                  inname="city"
                  value={address.city}
                  onChange={handlechange}
                />
              </Col>
              <Col md={4}>
                <Forminput
                  inlabel="ZIP Code"
                  intype="number"
                  inname="zipCode"
                  value={address.zipCode}
                  onChange={handlechange}
                />
              </Col>
            </Row>
            <div className="ModUpldbtn">
              <Button onClick={onHide}>Update</Button>
            </div>
          </Form>
        </div>
      </Modal.Body>
    </Modal>
  );
}

// Professional Background Modal
function Professionalbackground({
  show,
  onHide,
  professionalInfo,
  setProfessionalBackground,
}) {
  const handlechange = (e) => {
    setProfessionalBackground((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };
  return (
    <Modal
      show={show}
      onHide={onHide}
      className="PersnlModl"
      size="lg"
      aria-labelledby="contained-modal-title-vcenter"
      centered
    >
      <Modal.Header closeButton>
        <Modal.Title id="contained-modal-title-vcenter">
          Professional Background
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="PersonalInfoDiv">
          <Form>
            <Row>
              <Col md={4}>
                <Forminput
                  inlabel="Qualification"
                  intype="text"
                  inname="qualification"
                  value={professionalInfo.qualification}
                  onChange={handlechange}
                />
              </Col>
              <Col md={4}>
                <Forminput
                  inlabel="Medical License Number"
                  intype="text"
                  inname="medicalLicenseNumber"
                  value={professionalInfo.medicalLicenseNumber}
                  onChange={handlechange}
                />
              </Col>
              <Col md={4}>
                <Forminput
                  inlabel="Years of Experience"
                  intype="number"
                  inname="yearsOfExperience"
                  value={professionalInfo.yearsOfExperience}
                  onChange={handlechange}
                />
              </Col>
            </Row>

            <Row>
              <Col md={4}>
                <Forminput
                  inlabel="Languages Spoken"
                  intype="text"
                  inname="languagesSpoken"
                  value={professionalInfo.languagesSpoken}
                  onChange={handlechange}
                />
              </Col>
              <Col md={8}>
                <Forminput
                  inlabel="Biography/ Short Description"
                  intype="text"
                  inname="biography"
                  value={professionalInfo.biography}
                  onChange={handlechange}
                />
              </Col>
            </Row>
            <div className="ModUpldbtn">
              <Button onClick={onHide}>Update</Button>
            </div>
          </Form>
        </div>
      </Modal.Body>
    </Modal>
  );
}

function InfoDiv({ infpara, infhed }) {
  return (
    <div className="InfoProf">
      <p>{infpara}</p>
      <h5>{infhed}</h5>
    </div>
  );
}

InfoDiv.propTypes = {
  infpara: PropTypes.string.isRequired,
  infhed: PropTypes.string.isRequired,
};

export default DoctorProfile;
