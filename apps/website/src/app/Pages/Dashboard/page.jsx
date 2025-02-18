// eslint-disable-next-line no-unused-vars
import React, { useEffect, useState } from 'react';
import './Dashboard.css';
import PropTypes from 'prop-types';
import grph1 from '../../../../public/Images/graph1.png';
import grph2 from '../../../../public/Images/graph2.png';
import grph3 from '../../../../public/Images/graph3.png';
import Accpt from '../../../../public/Images/acpt.png';
import Decln from '../../../../public/Images/decline.png';
import box1 from '../../../../public/Images/box1.png';
import box2 from '../../../../public/Images/box2.png';
import box3 from '../../../../public/Images/box3.png';
import box4 from '../../../../public/Images/box4.png';
import { Link } from 'react-router-dom';
// import Topic from "../../../public/Images/topic.png";
import ActionsTable from '../../Components/ActionsTable/ActionsTable';
import StatusTable from '../../Components/StatusTable/StatusTable';
import axios from 'axios';
import StackedBarChart from '../Graph/page';
import { useAuth } from '../../context/useAuth';

const Dashboard = () => {
  const { userId } = useAuth();
  // Dropdown options
  const optionsList = [
    'Last 6 Months',
    'Last 7 Months',
    'Last 8 Months',
    'Last 9 Months',
  ];
  const [CancelCompletedGraph, setCancelCompletedGraph] = useState(null);
  console.table(CancelCompletedGraph);
  const AppointmentGraphOnMonthBase = async (selectedOption, userId) => {
    const days = parseInt(selectedOption.match(/\d+/)[0], 10);
    console.log(`Selected Days: ${days}`);
    try {
      const response = await axios.get(
        `${process.env.NX_PUBLIC_VITE_BASE_URL}api/hospitals/AppointmentGraphOnMonthBase?userId=${userId}`,
        {
          params: {
            days: days,
          },
        }
      );
      console.log(response.data);
      if (response) {
        setCancelCompletedGraph(
          response.data.data.map((v) => ({
            month: v.monthName,
            completed: v.successful,
            cancelled: v.canceled,
          }))
        );
      }
    } catch (error) {
      console.error(error);
    }
  };
  useEffect(() => {
    AppointmentGraphOnMonthBase('Last 6 Months', userId);
  }, [userId]);

  return (
    <section className="DashboardSection">
      <div className="container">
        <div className="MainDash">
          <div className="DashBoardTopDiv">
            <TopHeading
              spantext="Welcome"
              heding="Your Dashboard"
              notif="3 New Appointments"
            />
            <div className="dashvisible">
              <Link to="/clinicvisible">
                {' '}
                <a>
                  <i className="ri-eye-fill"></i> Manage Clinic Visibility
                </a>
              </Link>
            </div>
          </div>

          <div className="overviewDiv">
            <div className="overviewitem">
              <BoxDiv
                boximg={box1}
                ovradcls="chillibg"
                ovrtxt="Appointments"
                spanText="(Last 7 days)"
                boxcoltext="ciltext"
                overnumb="35"
              />
              <BoxDiv
                boximg={box2}
                ovradcls="purple"
                ovrtxt="Doctors"
                boxcoltext="purpletext"
                overnumb="12"
              />
              <BoxDiv
                boximg={box3}
                ovradcls="cambrageblue"
                ovrtxt="Specialities"
                boxcoltext="greentext"
                overnumb="6"
              />
              <BoxDiv
                boximg={box4}
                ovradcls="fawndark"
                ovrtxt="Revenue "
                spanText="(Last 7 days)"
                boxcoltext="frowntext"
                overnumb="$7,298"
              />
            </div>
          </div>

          <div className="DashGraphDiv">
            <div className="DashGraphCard">
              <div className="GraphTop">
                <h5>Appointments</h5>
                <ListSelect
                  options={optionsList}
                  onChange={AppointmentGraphOnMonthBase}
                />
              </div>
              <div className="graphimg">
                <StackedBarChart data={CancelCompletedGraph} />
              </div>
            </div>

            <div className="DashGraphCard">
              <div className="GraphTop">
                <h5>Revenue</h5>
                <ListSelect options={optionsList} />
              </div>
              <div className="graphimg">
                <img src={grph2} alt="graph2" />
              </div>
            </div>
          </div>

          <div>
            <DivHeading TableHead="New Appointments" tablespan="(3)" />
            <ActionsTable actimg1={Accpt} actimg2={Decln} />
            <SeeAll seehrf="/appointment" seetext="See All" />
          </div>

          <div>
            <DivHeading TableHead="Upcoming Assessments" tablespan="(3)" />
            <StatusTable />
            <SeeAll seehrf="/appointment" seetext="See All" />
          </div>

          <div>
            <DivHeading TableHead="Prescription Management" tablespan="" />
            <StatusTable />
            <SeeAll seehrf="/prescription" seetext="See All" />
          </div>

          <div className="SpecilityAppoint">
            <div className="row">
              <div className="col-md-6">
                <div className="GraphTop">
                  <h5>Speciality-wise appointments</h5>
                  <ListSelect options={optionsList} />
                </div>
                <div className="graphimg">
                  <img src={grph3} alt="graph3" />
                </div>
              </div>
              <div className="col-md-6">
                <div className="GraphTop">
                  <h5>Doctor-wise appointments</h5>
                  <ListSelect options={optionsList} />
                </div>
                <div className="graphimg">
                  <img src={grph3} alt="graph3" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Dashboard;

// ListSelect Component
ListSelect.propTypes = {
  options: PropTypes.arrayOf(PropTypes.string).isRequired,
  onChange: PropTypes.func.isRequired,
};

export function ListSelect({ options, onChange }) {
  return (
    <div className="grphSlect">
      <select
        className="form-select"
        aria-label="Default select example"
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((option, index) => (
          <option key={index} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

// see all btn
SeeAll.propTypes = {
  seetext: PropTypes.arrayOf(PropTypes.string).isRequired,
  seehrf: PropTypes.arrayOf(PropTypes.string).isRequired,
};
export function SeeAll({ seetext, seehrf }) {
  return (
    <div className="SeeAllDiv mt-5">
      <Link to={seehrf}>{seetext}</Link>
    </div>
  );
}

// BoxDiv Component

BoxDiv.propTypes = {
  boximg: PropTypes.string.isRequired,
  boxcoltext: PropTypes.string,
  spanText: PropTypes.string,
  ovrtxt: PropTypes.string,
  overnumb: PropTypes.string,
  ovradcls: PropTypes.string.isRequired, // Make sure to mark required if necessary
};

export function BoxDiv({
  boximg,
  boxcoltext,
  spanText,
  ovrtxt,
  overnumb,
  ovradcls,
}) {
  return (
    <div className="overbox">
      <div className={`overicon ${ovradcls}`}>
        <img src={boximg} alt="boximg" />
      </div>
      <div className="overText">
        <h6>
          {ovrtxt} {spanText && <span>{spanText}</span>}
        </h6>
        <h4 className={boxcoltext}>{overnumb}</h4>
      </div>
    </div>
  );
}

// TopHeading Component

TopHeading.propTypes = {
  spantext: PropTypes.string.isRequired,
  heding: PropTypes.string.isRequired,
  notif: PropTypes.string,
};

export function TopHeading({ spantext, heding, notif }) {
  return (
    <div className="Heading">
      <div className="leftHead">
        <span>{spantext}</span>
        <h2>{heding}</h2>
      </div>
      <div className="RytNotify">
        <a href="#">
          <i className="ri-notification-3-fill"></i> {notif}{' '}
        </a>
      </div>
    </div>
  );
}

// DivHeading

DivHeading.propTypes = {
  TableHead: PropTypes.string.isRequired,
  tablespan: PropTypes.string,
};
export function DivHeading({ TableHead, tablespan }) {
  return (
    <div className="TableHeading">
      <h5>
        {TableHead} {tablespan && <span>{tablespan}</span>}
      </h5>
    </div>
  );
}
