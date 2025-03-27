
import React, { useCallback, useEffect, useState } from 'react';
import './Clinic_visiblity.css';
import { HeadText } from '../SignUp/SignUp';
import { MainBtn } from '../Appointment/page';
// import whtcheck from '../../../../public/Images/whtcheck.png';
// import pft from '../../../../public/Images/pft.png';
import Gallery from '../../Components/Gallery/Gallery';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/useAuth';

const ClinicVisibility = () => {
  const { userId, onLogout } = useAuth();
  const navigate = useNavigate()

  const [profiles, setProfiles] = useState({});
  const [services, setServices] = useState([]);
  const [Departments, setDepartments] = useState([]);
  const [showAllServices, setShowAllServices] = useState(false);
  const [showAllDepartments, setShowAllDepartments] = useState(false);
  const [facility, setfacility] = useState([
    { name: 'Emergency Services', checked: true },
    { name: 'Cashless Facility', checked: false },
    { name: '24/7 Services', checked: true },
  ]);
  console.log(
    'facility',
    facility,
    'services',
    services,
    'departments',
    Departments
  );
  const fetchData = useCallback(async () => {
    try {
      const token = sessionStorage.getItem("token");
      const deptResponse = await axios.get(
        `${process.env.NX_PUBLIC_VITE_BASE_URL}api/hospitals/getDepartmentDataForHospitalProfile?userId=${userId}`,{headers:{Authorization:`Bearer ${token}`}}
      );

      const profileResponse = await axios.get(
        `${process.env.NX_PUBLIC_VITE_BASE_URL}api/hospitals/getVisibility?userId=${userId}`,
      );

      const { profile, departments } = deptResponse.data;
      const profileData = profileResponse.data;

      // Initialize facility, services, and departments with checked status
      setfacility([
        {
          name: 'Emergency Services',
          checked: profileData.facility.includes('Emergency Services'),
        },
        {
          name: 'Cashless Facility',
          checked: profileData.facility.includes('Cashless Facility'),
        },
        {
          name: '24/7 Services',
          checked: profileData.facility.includes('24/7 Services'),
        },
      ]);

      setServices(
        profile.selectedServices.map((service) => ({
          name: service,
          checked: profileData.services.includes(service),
        }))
      );

      setDepartments(
        departments.map((dept) => ({
          name: dept.departmentName,
          doctorCount: dept.doctorCount,
          checked: profileData.department.includes(dept.departmentName),
        }))
      );

      setProfiles(profile);
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('Session expired. Redirecting to signin...');
        onLogout(navigate);
      }
    }
  },[onLogout,navigate,userId]);

  useEffect(() => {
    fetchData();
  }, [userId, fetchData]);

  // Toggle Selections
  // const handleServiceToggle = (index) => {
  //   setServices((prev) =>
  //     prev.map((service, i) =>
  //       i === index ? { ...service, checked: !service.checked } : service
  //     )
  //   );
  // };

  const handleDepartmentToggle = (index) => {
    setDepartments((prev) =>
      prev.map((dept, i) =>
        i === index ? { ...dept, checked: !dept.checked } : dept
      )
    );
  };

  const handleCheckboxChangefacility = (index) => {
    setfacility((prev) =>
      prev.map((service, i) =>
        i === index ? { ...service, checked: !service.checked } : service
      )
    );
  };

  // Save Updated Profile to Backend
  const saveProfile = async () => {
    try {
      const token = sessionStorage.getItem("token");
      const selectedServices = services
        .filter((s) => s.checked)
        .map((s) => s.name);
      const selectedDepartments = Departments.filter((d) => d.checked).map(
        (d) => d.name
      );
      const facilitys = facility.filter((s) => s.checked).map((s) => s.name);
      await axios.post(
        `${process.env.NX_PUBLIC_VITE_BASE_URL}api/hospitals/saveVisibility?userId=${userId}`,
        { selectedServices, selectedDepartments, facilitys },{headers:{Authorization: `Bearer ${token}`}}
      );

      console.log('Profile updated successfully');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('Session expired. Redirecting to signin...');
        onLogout(navigate);
      }
    }
  };

  return (
    <section className="ClinicVisibleSec">
      <div className="container">
        <div className="visibletext">
          <HeadText Spntext="Control" blktext=" your clinic’s visibilty " />
          <p>
            Manage the visibility of your clinics departments, doctors, and
            services. Choose what to showcase to ensure a tailored experience
            for your clients.
          </p>
        </div>

        <div className="ClicVisibleData">
          <div className="LeftvisibleDiv">
            <div className="clicprofdiv">
              <img src={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/pft.png`} alt="Clinic Profile" />
              <div className="ClVDiv">
                <div className="clpfname">
                  <h4>{profiles.businessName}</h4>
                  <div className="loct">
                    <span>
                      <i className="ri-shining-2-fill"></i> 2.5mi
                    </span>
                  </div>
                  <div className="opencl">
                    <span>Open</span>
                    <p>Open 24 Hours</p>
                  </div>
                </div>
                <div className="Profcomp">
                  <button className="complete-button">
                    <i className="ri-edit-fill"></i> Edit Details
                  </button>
                </div>
              </div>
            </div>

            {/* Emergency Services Section */}
            <div className="EmergencyDrDiv">
              {facility.map((service, index) => (
                <label
                  key={index}
                  className={`Pfcheck ${service.checked ? 'selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={service.checked}
                    onClick={() => handleCheckboxChangefacility(index)}
                  />
                  {service.name}
                </label>
              ))}
            </div>

            {/* Services Section */}
            <div className="VisibleServiceDiv">
              <div className="ClServDiv">
                <h5>Services</h5>
                {services.length > 7 && (
                  <button onClick={() => setShowAllServices(!showAllServices)}>
                    {showAllServices ? 'See Less' : 'See More'}
                  </button>
                )}
              </div>
              <ul>
                {/* {(showAllServices ? services : services.slice(0, 7))?.map(
                  (service, index) => (
                    <li
                      key={index}
                      className={service.checked ? 'selected' : ''}
                    >
                      <label>
                        <input
                          type="checkbox"
                          checked={service.checked}
                          onClick={() => handleServiceToggle(index)}
                        />
                        {service.name}
                      </label>
                    </li>
                  )
                )} */}
              </ul>
            </div>

            {/* Departments Section */}
            <div className="VisibleServiceDiv">
              <div className="ClServDiv">
                <h5>Departments</h5>
                {Departments.length > 7 && (
                  <button
                    onClick={() => setShowAllDepartments(!showAllDepartments)}
                  >
                    {showAllDepartments ? 'See Less' : 'See More'}
                  </button>
                )}
              </div>
              <ul>
                {(showAllDepartments
                  ? Departments
                  : Departments.slice(0, 7)
                ).map((dept, index) => (
                  <li key={index} className={dept.checked ? 'selected' : ''}>
                    <label>
                      <input
                        type="checkbox"
                        checked={dept.checked}
                        onChange={() => handleDepartmentToggle(index)}
                      />
                      {dept.name}
                    </label>
                    {dept.checked && dept.doctorCount > 0 && (
                      <div className="department-info">
                        <p>{dept.doctorCount} Doctors</p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <MainBtn
              bimg={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/whtcheck.png`}
              btext="Update Visibility"
              optclas=""
              onClick={saveProfile}
            />
          </div>

          {/* Contact Information */}
          <div className="RytvisibleDiv">
            <div className="clinicContDetail">
              <h5>Contact Information</h5>
              <div className="Cont-info">
                <Link to="#">
                  <i className="ri-phone-fill"></i> {profiles.phoneNumber}
                </Link>
                <Link to="#">
                  <i className="ri-global-fill"></i> {profiles.website}
                </Link>
                <Link to="#">
                  <i className="ri-home-wifi-fill"></i>{' '}
                  {profiles.address &&
                    `${profiles.address.addressLine1}, ${profiles.address.street}, ${profiles.address.city}, ${profiles.address.state}, ${profiles.address.zipCode}`}
                </Link>
              </div>
            </div>
            <Gallery />
            <Gallery />
          </div>
        </div>
      </div>
    </section>
  );
};

export default ClinicVisibility;
