import React, { useCallback, useEffect, useState } from 'react';
import './Add_Doctor.css';
import PropTypes from 'prop-types';
import { BoxDiv } from '../Dashboard/page';
import { TextSpan } from '../Appointment/page';
import { DashHeadtext } from '../Doctor_Dashboard/Doctor_Dashboard';
// import Header from '../../Components/Header/Header';
// import box1 from '../../../../public/Images/box1.png';
// import box2 from '../../../../public/Images/box2.png';
// import box3 from '../../../../public/Images/box3.png';
// import box4 from '../../../../public/Images/box4.png';
// import Doctor1 from '../../../../public/Images/Doctor1.png';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { propTypes } from 'react-bootstrap/esm/Image';
import { useAuth } from '../../context/useAuth';
import  {FHIRParser}  from '../../utils/FhirMapper';
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
const Add_Doctor = () => {
  const { userId, onLogout } = useAuth();
  const navigate = useNavigate();

  const [doctorsData, setDoctorsData] = useState({});
  const [overview, setOverview] = useState([]);
  const [search, setSearch] = useState('');
  // console.log('doctorsData', doctorsData);

  const debouncedSearch = useDebounce(search, 500);
  const getaDoctors = useCallback(async () => {
    try {
      // Get the token from sessionStorage
      const token = sessionStorage.getItem('token');

      const response = await axios.get(
        `${import.meta.env.VITE_BASE_URL}fhir/v1/Practitioner?name=${debouncedSearch}&bussinessId=${userId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status === 200) {
        // console.log('response', response.data);

        let parsedData =
          typeof response.data === 'string'
            ? JSON.parse(response.data)
            : response.data;

        const parser = new FHIRParser(parsedData);
        // console.log('parser', parser);

        const normalData = parser.convertToNormal();
        // console.log('Converted Normal Data:', normalData);

        setDoctorsData(normalData);
      } else {
       new Swal({
          title: 'Error',
          text: 'Failed to fetch doctors data.',
          icon: 'error',
          buttons: 'OK',
        
       })
      }
    } catch (error) {
      console.error('Error fetching doctors data:', error);

      // Handle error with swal for different scenarios
      if (error.response) {
        const { status, data } = error.response;

        // Handle specific status codes with swal
        if (status === 401) {
          new Swal({
            title: 'Session Expired',
            text: 'Your session has expired. Please log in again.',
            icon: 'error',
            buttons: 'OK',
          }).then(() => {
            onLogout(navigate); // Redirect to signin
          });
        } else if (status === 404) {
          new Swal({
            title: 'Not Found',
            text: 'Doctors data not found.',
            icon: 'error',
            buttons: 'OK',
          });
        } else if (status === 500) {
          new Swal({
            title: 'Server Error',
            text: 'Internal server error while fetching doctors data.',
            icon: 'error',
            buttons: 'OK',
          });
        } else {
          new Swal({
            title: 'Error',
            text: `An error occurred: ${data?.message || 'Unknown error'}`,
            icon: 'error',
            buttons: 'OK',
          });
        }

        // Optionally, handle FHIR-specific errors in the response (if the server returns an OperationOutcome)
        if (data && data.resourceType === 'OperationOutcome') {
          new Swal({
            title: 'FHIR Error',
            text: data.issue[0]?.details?.text || 'Unknown FHIR error',
            icon: 'error',
            buttons: 'OK',
          });
        }
      } else if (error.request) {
        // Network error (no response received)
        new Swal({
          title: 'Network Error',
          text: 'No response was received from the server. Please check your network connection.',
          icon: 'error',
          buttons: 'OK',
        });
      } else {
        // Any other error
        new Swal({
          title: 'Error',
          text: `Error: ${error.message}`,
          icon: 'error',
          buttons: 'OK',
        });
      }
    }
  }, [userId, navigate, onLogout, debouncedSearch]);

  const getOverview = useCallback(async () => {

    const token = sessionStorage.getItem("token");
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_BASE_URL}fhir/v1/MeasureReport`,
        {
          params: {
            subject: `Organization/${userId}`,
            reportType: 'summary',
            type: "HospitalSideDoctorOverview",
          },
          headers:{Authorization:`Bearer ${token}`}
        }
      );
      if (response) {
        const data = new FHIRParser(JSON.parse(response.data));
        // console.log('overviewData', data);
        const normalData = data.overviewConvertToNormal();
        setOverview(normalData);
        // console.log('overview', normalData);
      }
    } catch (error) {
      if (error.response) {
        const { status, data } = error.response;
        if (status === 401) {
          onLogout(navigate);
        } else if (status === 404) {
          new Swal({
            title: 'Not Found',
            text: 'MeasureReport not found.',
            icon: 'error',
            buttons: 'OK',
          });
        } else if (status === 500) {
          new Swal({
            title: 'Server Error',
            text: 'Internal server error while fetching MeasureReport data.',
            icon: 'error',
            buttons: 'OK',
          });
        } else {
          new Swal({
            title: 'Error',
            text: `An error occurred: ${data?.message || 'Unknown error'}`,
            icon: 'error',
            buttons: 'OK',
          });
        }

        if (data && data.resourceType === 'OperationOutcome') {
          new Swal({
            title: 'FHIR Error',
            text: data.issue[0]?.details?.text || 'Unknown FHIR error',
            icon: 'error',
            buttons: 'OK',
          });
        }
      } else if (error.request) {
        new Swal({
          title: ' Network Error',
          text: 'No response was received from the server. Please check your network connection.',
          icon: 'error',
          buttons: 'OK',
        });
      } else {
        new Swal({
          title: 'Error',
          text: `Error: ${error.message}`,
          icon: 'error',
          buttons: 'OK',
        });
      }
    }
  }, [userId, navigate, onLogout]);
  useEffect(() => {
    getaDoctors();
    getOverview();
  }, [debouncedSearch, userId, getOverview, getaDoctors]);

  const handleSearch = (e) => {
    setSearch(e.target.value);
  };

  return (
    <>
      {/* <Header/> */}
      <section className="AddDoctorSec">
        <div className="container">
          <div className="MainDash">
            <AddSerchHead
              adtext="Doctors"
              adbtntext="Add Doctor"
              adhrf="/addvet"
              onChange={handleSearch}
            />

            <div className="overviewDiv">
              <TextSpan Textname="Overview" />
              <div className="overviewitem">
                <BoxDiv
                  boximg={`${import.meta.env.VITE_BASE_IMAGE_URL}/box2.png`}
                  ovradcls="purple"
                  ovrtxt="Specialities"
                  boxcoltext="purpletext"
                  overnumb={overview.totalSpecializations}
                />
                <BoxDiv
                  boximg={`${import.meta.env.VITE_BASE_IMAGE_URL}/box4.png`}
                  ovradcls=" fawndark"
                  ovrtxt="Total Doctors"
                  boxcoltext="frowntext"
                  overnumb={overview.totalDoctors}
                />

                <BoxDiv
                  boximg={`${import.meta.env.VITE_BASE_IMAGE_URL}/box3.png`}
                  ovradcls=" cambrageblue"
                  ovrtxt="On-Duty"
                  boxcoltext="greentext"
                  overnumb={overview.availableDoctors}
                />
                <BoxDiv
                  boximg={`${import.meta.env.VITE_BASE_IMAGE_URL}/box1.png`}
                  ovradcls="chillibg"
                  ovrtxt="Average Ratings"
                  boxcoltext="ciltext"
                  overnumb="4.75"
                />
              </div>
            </div>

            <div></div>

            <div>
              {Object.keys(doctorsData || {})?.map((specialization, index) => {
                const doctors = doctorsData[specialization];
                return (
                  <div className="DoctorCardData" key={index}>
                    <DashHeadtext
                      htxt={specialization}
                      hspan={`(${doctors.length})`}
                    />
                    <div className="DoctcardItems">
                      {doctors.map((doctor, doctorIndex) => (
                        <DoctorCard
                          key={doctorIndex}
                          doctimg={doctor.image} // Replace with dynamic image if available
                          doctname={doctor.doctorName}
                          doctpotion={doctor.qualification}
                          dutyname={
                            doctor.isAvailable === '0' ? 'Off-Duty' : 'On-Duty'
                          } // Ensure dutyname is handled
                          offclass={
                            doctor.isAvailable === '0' ? 'OffDuty' : 'OnDuty'
                          } // Add dynamic class based on duty
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export default Add_Doctor;

DoctorCard.propTypes = {
  doctimg: PropTypes.string.isRequired,
  doctname: PropTypes.string.isRequired,
  doctpotion: PropTypes.string.isRequired,
  offclass: PropTypes.string.isRequired,
  dutyname: PropTypes.string.isRequired,
  Revdate: PropTypes.string.isRequired,
  rating: PropTypes.string.isRequired,
  Revpara1: PropTypes.string.isRequired,
  Revpara2: PropTypes.string.isRequired,
};

export function DoctorCard({
  doctimg,
  doctname,
  doctpotion,
  offclass,
  dutyname,
}) {
  return (
    <div className="DoctrCard">
      <img src={doctimg} alt="Doctor Img" />
      <div className="drnmetext">
        <h6>{doctname}</h6>
        <p>{doctpotion}</p>
      </div>
      <Link className={`dutybtn ${offclass}`} to="#">
        {dutyname}{' '}
      </Link>
    </div>
  );
}

// AddSerchHead

AddSerchHead.propTypes = {
  adtext: PropTypes.string.isRequired,
  adbtntext: PropTypes.string.isRequired,
  adhrf: PropTypes.string.isRequired,
  onChange: propTypes.string,
};
export function AddSerchHead({ adtext, adbtntext, adhrf, onChange }) {
  return (
    <div className="AddTopDoct">
      <h2>{adtext}</h2>
      <div className="addoct">
        <div className="Searchbar">
          <input
            type="text"
            id="searchQueryInput"
            name="searchQueryInput"
            className="form-control"
            placeholder="Search by name"
            aria-label="Username"
            aria-describedby="basic-addon1"
            onChange={onChange}
          />
          <button id="searchQuerySubmit" type="submit" name="searchQuerySubmit">
            <i className="ri-search-line"></i>
          </button>
        </div>
        <Link to={adhrf}>
          <i className="ri-add-circle-line"></i>
          {adbtntext}{' '}
        </Link>
      </div>
    </div>
  );
}
