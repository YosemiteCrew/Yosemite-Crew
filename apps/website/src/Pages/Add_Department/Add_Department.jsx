
import React, { useCallback, useEffect, useState } from 'react';
import './Add_Department.css';
import { Forminput, HeadText } from '../SignUp/SignUp';
import { ProfileProg } from '../SignUpDetails/SignUpDetails';
import { MainBtn } from '../Appointment/page';
// import whtcheck from '../../../../public/Images/whtcheck.png';
// import OperatingHours from '../../Components/OperatingHours/OperatingHours';
import axios from 'axios';
import { useAuth } from '../../context/useAuth';
import { useNavigate } from 'react-router-dom';
import countrycode from './countriescities.json';
import { FHIRParser } from '../../utils/FhirMapper';
import { DepartmentFHIRConverter } from '../../utils/DepartmentFHIRMapper';
import Swal from 'sweetalert2';

const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
};
const Add_Department = () => {

  // Department Head
  const [selectedCode, setSelectedCode] = useState('+91');
  const [searchTerms, setSearchTerms] = useState('');

  // Filter countries based on search input
  const filteredCountries = countrycode.filter(
    (country) =>
      country.countryCode.includes(searchTerms) ||
      country.label.toLowerCase().includes(searchTerms.toLowerCase())
  );
  const [servicesList, setservicesList] = useState([]);


  const { userId,onLogout } = useAuth();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
 

  const debouncedSearch = useDebounce(searchTerm, 500);
 
  const getaDoctors = useCallback(async () => {
   
    try {
      // Get the token from sessionStorage
      const token = sessionStorage.getItem('token');

      if (!token) {
        console.error('No token found in sessionStorage');
        // await verifyAndRefreshToken(navigate); // Call the function from AuthContext
        navigate('/signin');
      }
      const response = await axios.get(
        `${import.meta.env.VITE_BASE_URL}fhir/v1/Practitioner?name=${debouncedSearch}&bussinessId=${userId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`, // Attach the token to the request headers
          },
        }
      );

      if (response && response.data) {
        let parsedData =
        typeof response.data === 'string'
          ? JSON.parse(response.data)
          : response.data;

      const parser = new FHIRParser(parsedData);


      const normalData = parser.convertToNormal();
        setservicesList(
          Object.values(normalData)
            .flat() // Flatten the array of arrays
            .map((v, ) => ({
              id: v.userId,
              name: v.doctorName,
              pic: v.image,
            }))
        );
      } else {
        console.log('No data found');
      }
    } catch (error) {
      console.error('Error fetching doctors data:', error);
    }
  },[userId,debouncedSearch,navigate]);

  useEffect(() => {
    getaDoctors();
  }, [debouncedSearch, userId,getaDoctors]);
  const handleSearch = (event) => {
    setSearchTerm(event.target.value);

  };

 

  const [selectedServices, setSelectedServices] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // const [operatingHours, setOperatingHours] = useState([]);
  const [departmentName, setDepartmentName] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
 

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };
  const handleSelectService = (id) => {
    setSelectedServices((prevSelected) =>
      prevSelected.includes(id)
        ? prevSelected.filter((serviceId) => serviceId !== id)
        : [...prevSelected, id]
    );
  };
  const filteredServices = servicesList?.filter((service) =>
    service.name.toLowerCase().includes(searchTerm.toLowerCase())
  );


  const [services, setServices] = useState([
    { id: 1, label: 'Cardiac Health Screenings', checked: true },
    { id: 2, label: 'Echocardiograms', checked: true },
    { id: 3, label: 'Electrocardiograms (ECG)', checked: false },
    { id: 4, label: 'Blood Pressure Monitoring', checked: true },
    { id: 5, label: 'Holter Monitoring', checked: false },
    { id: 6, label: 'Cardiac Catheterization', checked: true },
    { id: 7, label: 'Congenital Heart Disease Management', checked: false },
  ]);

  const [conditionsTreated, setConditions] = useState([
    { id: 1, label: 'Congestive Heart Failure', checked: true },
    { id: 2, label: 'Arrhythmias', checked: true },
    { id: 3, label: 'Heart Murmurs', checked: false },
    { id: 4, label: 'Dilated Cardiomyopathy', checked: true },
    { id: 5, label: 'Valvular Heart Disease', checked: false },
    { id: 6, label: 'Pericardial Effusion', checked: true },
    { id: 7, label: 'Myocarditis', checked: false },
  ]);

  const [selectAllServices, setSelectAllServices] = useState(false);
  const [selectAllConditions, setSelectAllConditions] = useState(false);

  // Handle individual checkbox change for services
  const handleServiceCheckboxChange = (id) => {
    setServices((prevServices) =>
      prevServices.map((service) =>
        service.id === id ? { ...service, checked: !service.checked } : service
      )
    );
  };

  // Handle individual checkbox change for conditions
  const handleConditionCheckboxChange = (id) => {
    setConditions((prevConditions) =>
      prevConditions.map((condition) =>
        condition.id === id
          ? { ...condition, checked: !condition.checked }
          : condition
      )
    );
  };

  // Handle "Select All / Unselect All" for services
  const handleSelectAllServices = () => {
    const newState = !selectAllServices;
    setSelectAllServices(newState);
    setServices((prevServices) =>
      prevServices.map((service) => ({ ...service, checked: newState }))
    );
  };

  // Handle "Select All / Unselect All" for conditions
  const handleSelectAllConditions = () => {
    const newState = !selectAllConditions;
    setSelectAllConditions(newState);
    setConditions((prevConditions) =>
      prevConditions.map((conditionsTreated) => ({
        ...conditionsTreated,
        checked: newState,
      }))
    );
  };
  // Add Services & Conditions Section

  // ConsultationModeDiv
  const [activeModes, setActiveModes] = useState(['In-person']); // Initialize "In-person" as active
  const handleModeClick = (mode) => {
    if (mode === 'Both') {
      // When "Both" is clicked, make "In-person" and "Online" active
      setActiveModes(['In-person', 'Online']);
    } else if (
      activeModes.includes('In-person') &&
      activeModes.includes('Online')
    ) {
      // If "Both" is active and another mode is clicked, clear "Both" and set the clicked mode
      setActiveModes([mode]);
    } else {
      // For normal toggling between "In-person" and "Online"
      setActiveModes([mode]);
    }
  };
  // ConsultationModeDiv

  const handlePhoneChange = (e) => {
    // Update the phone number state when the user types in the input field
    setPhone(e.target.value);
  };

  // const handleSaveOperatingHours = (updatedHours) => {
  //   // Process the received operating hours (for example, send it to an API or just log it)
  //   setOperatingHours(updatedHours);

  // };

  const handleSubmit = async () => {
    const departmentData = {
      departmentName,
      description,
      email,
      phone,
      bussinessId: userId,
      countrycode: selectedCode,
      // operatingHours,
      services: services.filter((s) => s.checked).map((s) => s.label),
      conditionsTreated: conditionsTreated
        .filter((c) => c.checked)
        .map((c) => c.label),
      consultationModes: activeModes,
      departmentHeadId: selectedServices[0],
    };
   const data = new DepartmentFHIRConverter(departmentData).toFHIR()



    try {
      const token = sessionStorage.getItem("token");
      const response = await axios.post(
        `${import.meta.env.VITE_BASE_URL}fhir/v1/HealthcareService`,
        data ,{headers:{Authorization:`Bearer ${token}`}}
      );

      if (response.status === 201) {
        Swal.fire({
          icon: "success",
          title: "Success!",
          text: "Department Added.",
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'OK'
        
        })
        navigate("/department");
      }
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('Session expired. Redirecting to signin...');
        onLogout(navigate);
      }
    }
  };
  return (
    <section className="ProfileSec">
      <div className="container">
        <div className="mb-3">
          <HeadText Spntext="Add" blktext="Department" />
        </div>

        <div className="Add_Profile_Data">
          <div className="LeftProfileDiv">
            <div className="DepartFormDiv">
              <Forminput
                inlabel="Department Name"
                intype="text"
                inname="name"
                value={departmentName}
                onChange={(e) => setDepartmentName(e.target.value)}
              />
              <div className="form-floating  mb-3">
                <textarea
                  className="form-control"
                  placeholder="Description"
                  id="floatingTextarea2"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                ></textarea>
                <label htmlFor="floatingTextarea2">Description</label>
              </div>
              <Forminput
                inlabel="Email Address"
                intype="email"
                inname="name"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <div className="row">
                <div className="col-md-2">
                  {/* Country Code Field */}
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
                      value={selectedCode}
                      onChange={(e) => setSelectedCode(e.target.value)}
                    >
                      {filteredCountries.map((country, index) => (
                        <option key={index} value={country.countryCode}>
                          {country.emoji} {country.countryCode}
                        </option>
                      ))}
                    </select>
                  </div>
                  {/* Form Input Field */}
                </div>
                <div className="col-md-10">
                  {/* Phone Number Field */}
                  <Forminput
                    inlabel="Phone Number"
                    intype="number"
                    inname="phone"
                    value={phone} // Bind the phone number state
                    onChange={handlePhoneChange} // Handle change event for phone number
                  />
                </div>
              </div>
            </div>

            {/* Services Section */}
            <div className="AddServices">
              <div className="topServices">
                <p>Add Services</p>
                <button onClick={handleSelectAllServices}>
                  {selectAllServices ? 'Unselect All' : 'Select All'}
                </button>
              </div>
              <div className="AdServData">
                {services.map((service) => (
                  <div className="ServicsInner" key={service.id}>
                    <label
                      className="form-check-label"
                      htmlFor={`service-checkbox-${service.id}`}
                      style={{
                        color: service.checked ? '#D04122' : '#37223C',
                        fontWeight: service.checked ? '700' : '400',
                      }}
                    >
                      {service.label}
                    </label>
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id={`service-checkbox-${service.id}`}
                      checked={service.checked}
                      onChange={() => handleServiceCheckboxChange(service.id)}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="DepartmentHead">
              <div
                className={`ServHeadr ${isDropdownOpen ? 'open' : ''}`}
                onClick={toggleDropdown}
              >
                <span>Department Head</span>
                <span className="arrow">{isDropdownOpen ? '▲' : '▼'}</span>
              </div>
              {isDropdownOpen && (
                <div className="DepartDropcontent">
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
                        key={service.id}
                        className={`service-item ${
                          selectedServices.includes(service.id)
                            ? 'selected'
                            : ''
                        }`}
                      >
                        <div className="departtext">
                          <img src={service.pic} alt="" />
                          <p>{service.name}</p>
                        </div>

                        <input
                          type="radio"
                          className="form-check-input"
                          checked={selectedServices.includes(service.id)}
                          onChange={() => handleSelectService(service.id)}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* <OperatingHours
                onSave={handleSaveOperatingHours}
                Optrtname="Operating Hours"
              /> */}

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
                    className={activeModes.includes('Online') ? 'active' : ''}
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

            {/* Conditions Section */}
            <div className="AddServices">
              <div className="topServices">
                <p>Conditions Treated</p>
                <button onClick={handleSelectAllConditions}>
                  {selectAllConditions ? 'Unselect All' : 'Select All'}
                </button>
              </div>
              <div className="AdServData">
                {conditionsTreated.map((condition) => (
                  <div className="ServicsInner" key={condition.id}>
                    <label
                      className="form-check-label"
                      htmlFor={`condition-checkbox-${condition.id}`}
                      style={{
                        color: condition.checked ? '#D04122' : '#37223C',
                        fontWeight: condition.checked ? '700' : '400',
                      }}
                    >
                      {condition.label}
                    </label>
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id={`condition-checkbox-${condition.id}`}
                      checked={conditionsTreated.checked}
                      onChange={() =>
                        handleConditionCheckboxChange(conditionsTreated.id)
                      }
                    />
                  </div>
                ))}
              </div>
            </div>

            <MainBtn
              bimg={`${import.meta.env.VITE_BASE_IMAGE_URL}/whtcheck.png`}
              onClick={() => handleSubmit()}
              btext="Add Department"
              optclas=""
              btntyp="submit"
            />
          </div>

          <div className="RytProfileDiv">
            <ProfileProg blname="Completion" spname="Progress" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default Add_Department;
