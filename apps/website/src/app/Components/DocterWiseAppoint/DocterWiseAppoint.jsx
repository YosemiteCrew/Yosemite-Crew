import React, { useCallback, useEffect, useState } from 'react';
import './DocterWiseAppoint.css';
import PropTypes from 'prop-types';
import { MdAttachMoney } from 'react-icons/md';
// import doct1 from "../../../../public/Images/doct1.png"
// import doct2 from "../../../../public/Images/doct2.png"
// import doct3 from "../../../../public/Images/doct3.png"
// import doct4 from "../../../../public/Images/doct4.png"
import axios from 'axios';
import { useAuth } from '../../context/useAuth';
import { useNavigate } from 'react-router-dom';
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

const DocterWiseAppoint = ({ DoctWiseTable = [] }) => {
  const { userId,onLogout } = useAuth();
  const navigate = useNavigate()
  const [search, setSearch] = useState('');
  const [days, setDays] = useState('Last 7 Days');
  // const [totalAppointments, setTotalAppointments] = useState(0)
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPage, setTotalPage] = useState(1);
  const [appointmentsData, setAppointmentsData] = useState([]);
  console.log('appointmentsData', appointmentsData);
  const debouncedSearch = useDebounce(search, 500);
  const getAppointmentsData = useCallback(async () => {
    try {
      const token = sessionStorage.getItem("token");
      const response = await axios.get(
        `${process.env.NX_PUBLIC_VITE_BASE_URL}api/hospitals/getDoctorsTotalAppointments`,
        { params: { userId: userId, search: debouncedSearch, LastDays: days } ,headers:{Authorization:`Bearer ${token}`}}
      );
      if (response) {
        console.log('responseeeeee', response.data);
        // setTotalAppointments(response.data.totalCount)
        setCurrentPage(response.data.page);
        setTotalPage(response.data.totalPages);
        setAppointmentsData(response.data.totalAppointments);
      }
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('Session expired. Redirecting to signin...');
        onLogout(navigate);
      }
    }
  }, [userId, debouncedSearch,days, navigate, onLogout]);
  useEffect(() => {
    if (userId) {
      getAppointmentsData();
    }
  }, [userId, getAppointmentsData]);

  const handleSearch = async (val) => {
    console.log('search', val.target.value);
    setSearch(val.target.value);
  };
const handleSelect = (val) => {
  const day = parseInt(val.match(/\d+/)[0], 10);
  // console.log('days', day)
  setDays(day)
}
  // Dropdown options
  const options = [
    'Last 7 Days',
    'Last 10 Days',
    'Last 20 Days',
    'Last 21 Days',
  ];

  const handleNext = () => {
    if (currentPage < totalPage) {
      setCurrentPage((prevPage) => prevPage + 1);
    }
  };

  const handlePrev = () => {
    if (currentPage > 1) {
      setCurrentPage((prevPage) => prevPage - 1);
    }
  };

  return (
    <>
      <div className="WiseHeadDiv">
        <h4>Doctor appointments</h4>
        <div className="DoctWiseSeclt">
          <div className="Searchbar">
            <input
              type="text"
              id="searchQueryInput"
              name="searchQueryInput"
              className="form-control"
              placeholder="Search by name"
              aria-label="Username"
              aria-describedby="basic-addon1"
              onChange={handleSearch}
            />
            <button
              id="searchQuerySubmit"
              type="submit"
              name="searchQuerySubmit"
            >
              <i className="ri-search-line"></i>
            </button>
          </div>

          <select className="form-select" aria-label="Default select example" onChange={(e) => handleSelect(e.target.value)}>
            {options.map((option, index) => (
              <option key={index} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="MainTableDiv">
        <table className="DoctWiseableDiv">
          <thead>
            <tr>
              <th scope="col"></th>
              <th scope="col">Doctor</th>
              <th scope="col">Appointments</th>
              <th scope="col">Assessments</th>
              <th scope="col">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {appointmentsData.map((DoctWiseTable, index) => (
              <tr key={index}>
                <th scope="row">
                  <div className="dogimg">
                    <img src={DoctWiseTable.image} alt={DoctWiseTable.image} />
                  </div>
                </th>
                <td>
                  <div className="TBLDIV">
                    <h4>{DoctWiseTable.doctorName}</h4>
                    <p>{DoctWiseTable.department}</p>
                  </div>
                </td>
                <td>{DoctWiseTable.totalAppointments}</td>
                <td>{DoctWiseTable?.Asistid}</td>
                <td>
                  <span>
                    <MdAttachMoney />
                  </span>
                  {DoctWiseTable?.Renenu}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* Pagination Controls */}
        <div className="PaginationDiv">
          <button onClick={handlePrev} disabled={currentPage === 1}>
            <i className="ri-arrow-left-line"></i>
          </button>

          <h6 className="PagiName">
            Page {currentPage} of {totalPage}
          </h6>

          <button onClick={handleNext} disabled={currentPage >= totalPage}>
            <i className="ri-arrow-right-line"></i>
          </button>
        </div>
      </div>
    </>
  );
};

DocterWiseAppoint.propTypes = {
  DoctWiseTable: PropTypes.arrayOf(
    PropTypes.shape({
      DoctImage: PropTypes.string.isRequired,
      DoctName: PropTypes.string.isRequired,
      PostName: PropTypes.string.isRequired,
      Apointid: PropTypes.string.isRequired,
      Asistid: PropTypes.string.isRequired,
      Renenu: PropTypes.string.isRequired,
    })
  ),
};

export default DocterWiseAppoint;
