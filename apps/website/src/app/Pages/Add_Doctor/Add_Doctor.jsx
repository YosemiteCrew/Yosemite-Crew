import React, { useEffect, useState } from 'react';
import './Add_Doctor.css';
import PropTypes from 'prop-types';
import { BoxDiv } from '../Dashboard/page';
import { TextSpan } from '../Appointment/page';
import { DashHeadtext } from '../Doctor_Dashboard/Doctor_Dashboard';
// import Header from '../../Components/Header/Header';
import box1 from '../../../../public/Images/box1.png';
import box2 from '../../../../public/Images/box2.png';
import box3 from '../../../../public/Images/box3.png';
import box4 from '../../../../public/Images/box4.png';
// import Doctor1 from '../../../../public/Images/Doctor1.png';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { propTypes } from 'react-bootstrap/esm/Image';
import { useAuth } from '../../context/useAuth';

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
  console.log('doctorsData', doctorsData);

  const debouncedSearch = useDebounce(search, 500);
  const getaDoctors = async () => {
    try {
      // Get the token from sessionStorage
      const token = sessionStorage.getItem('token');

      const response = await axios.get(
        `${process.env.NX_PUBLIC_VITE_BASE_URL}api/doctors/searchDoctorsByName?name=${debouncedSearch}&bussinessId=${userId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`, // Attach the token to the request headers
          },
        }
      );

      if (response.status === 200) {
        setDoctorsData(response.data);
      } else {
        console.log('No data found');
      }
    } catch (error) {
      console.error('Error fetching doctors data:', error);

      // If the session is expired or token is invalid (401 Unauthorized)
      if (error.response && error.response.status === 401) {
        console.log('Session expired. Redirecting to signin...');
        onLogout(navigate);
      }
    }
  };

  const getOverview = async () => {
    try {
      const response = await axios.get(
        `${process.env.NX_PUBLIC_VITE_BASE_URL}api/doctors/getOverview`
      );
      if (response) {
        setOverview(response.data);
        console.log('overview', response.data);
      }
    } catch (error) {
      console.error('Error fetching overview:', error);
    }
  };

  useEffect(() => {
    getaDoctors();
    getOverview();
  }, [debouncedSearch, userId]);

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
                  boximg={box2}
                  ovradcls="purple"
                  ovrtxt="Specialities"
                  boxcoltext="purpletext"
                  overnumb={overview.totalSpecializations}
                />
                <BoxDiv
                  boximg={box4}
                  ovradcls=" fawndark"
                  ovrtxt="Total Doctors"
                  boxcoltext="frowntext"
                  overnumb={overview.totalDoctors}
                />

                <BoxDiv
                  boximg={box3}
                  ovradcls=" cambrageblue"
                  ovrtxt="On-Duty"
                  boxcoltext="greentext"
                  overnumb={overview.availableDoctors}
                />
                <BoxDiv
                  boximg={box1}
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
