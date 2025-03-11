// eslint-disable-next-line no-unused-vars
import React, { useEffect, useState } from 'react';
import './DepartmentsMain.css';
// import { TextSpan } from '../Appointment/page'
import { BoxDiv, ListSelect } from '../Dashboard/page';
import box1 from '../../../../public/Images/box1.png';
import box2 from '../../../../public/Images/box2.png';
import box3 from '../../../../public/Images/box3.png';
import box4 from '../../../../public/Images/box4.png';
import { AddSerchHead } from '../Add_Doctor/Add_Doctor';
import DepartmentAppointmentsChart from '../../Components/BarGraph/DepartmentAppointmentsChart';
import WeeklyAppointmentsChart from '../../Components/BarGraph/WeeklyAppointmentsChart';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useAuth } from '../../context/useAuth';
import { useNavigate } from 'react-router-dom';

const DepartmentsMain = () => {
  const [DepartmentsOverView, SetDepartmentsOverView] = useState({});
  const { userId ,onLogout} = useAuth();
  const navigate = useNavigate()
  const optionsList1 = [
    'Last 7 Days',
    'Last 10 Days',
    'Last 20 Days',
    'Last 21 Days',
  ];

  const GetDepartmentsOverView = async (selectedOption) => {
    const days = parseInt(selectedOption.match(/\d+/)[0], 10);
    console.log(`Selected Days: ${days}`);
    try {
      const token = sessionStorage.getItem("token");
      const response = await axios.get(
        `${process.env.NX_PUBLIC_VITE_BASE_URL}api/hospitals/departmentsOverView?userId=${userId}`,
        {
          params: {
            LastDays: days,
          },
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response) {
        SetDepartmentsOverView(response.data.data);
      }
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('Session expired. Redirecting to signin...');
        onLogout(navigate);
      }
      Swal.fire({
        title: 'Error',
        text: 'Failed to get departments overview',
        icon: 'error',
        confirmButtonText: 'OK',
      });
    }
  };
  const [graphData, setGraphData] = useState([]);
  console.log('graph', graphData);
  const DepartmentBasisAppointmentGraph = async (selectedOption) => {
    const days = parseInt(selectedOption.match(/\d+/)[0], 10);
    console.log(`Selected Days: ${days}`);

    try {
      const token = sessionStorage.getItem("token");
      const response = await axios.get(
        `${process.env.NX_PUBLIC_VITE_BASE_URL}api/hospitals/DepartmentBasisAppointmentGraph?userId=${userId}`,
        {
          params: {
            LastDays: days,
          },
          headers: {Authorization: `Bearer ${token}`},
        }
      );
      if (response) {
        // Transform API response to match expected format
        const formattedData = response.data.data.map((item) => ({
          name: item.departmentName,
          appointments: item.count,
        }));
        setGraphData(formattedData);
      }
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('Session expired. Redirecting to signin...');
        onLogout(navigate);
      }
      Swal.fire({
        title: 'Error',
        text: 'Failed to get department basis appointment graph',
        icon: 'error',
        confirmButtonText: 'OK',
      });
    }
  };
  const [WeeklyAppointmentGraph, setweeklyAppoinmentGraph] = useState({});
  console.log('WeeklyAppointmentGraph', WeeklyAppointmentGraph);
  const getDataForWeeklyAppointmentChart = async () => {
    try {
      const token = sessionStorage.getItem('token')
      const response = await axios.get(
        `${process.env.NX_PUBLIC_VITE_BASE_URL}api/hospitals/getDataForWeeklyAppointmentChart?userId=${userId}`,{headers:{Authorization:`Bearer ${token}`}}
      );
      if (response) {
        const formattedData = response.data.data.map((item) => ({
          name: item.day,
          appointments: item.count,
        }));
        setweeklyAppoinmentGraph(formattedData);
      }
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('Session expired. Redirecting to signin...');
        onLogout(navigate);
      }
      Swal.fire({
        title: 'Error',
        text: 'Failed to get weekly appointment chart data',
        icon: 'error',
        confirmButtonText: 'OK',
      });
    }
  };
  useEffect(() => {
    getDataForWeeklyAppointmentChart();
    DepartmentBasisAppointmentGraph('Last 7 Days');
    GetDepartmentsOverView('Last 7 Days');
  }, [userId]);
  return (
    <section className="Department_MainSec">
      <div className="container">
        <div className="MainDash">
          <AddSerchHead
            adtext="Departments"
            adbtntext="Add Department"
            adhrf="/add_department"
          />

          <div className="overviewDiv">
            <div className="OverviewTop">
              <h5>Overview</h5>
              <ListSelect
                options={optionsList1}
                onChange={GetDepartmentsOverView}
              />
            </div>
            <div className="overviewitem">
              <BoxDiv
                boximg={box2}
                ovradcls="purple"
                ovrtxt="Departments"
                boxcoltext="purpletext"
                overnumb={DepartmentsOverView.departments}
              />
              <BoxDiv
                boximg={box4}
                ovradcls=" fawndark"
                ovrtxt="Total Doctors "
                boxcoltext="frowntext"
                overnumb={DepartmentsOverView.doctors}
              />
              <BoxDiv
                boximg={box3}
                ovradcls=" cambrageblue"
                ovrtxt="New Animal"
                boxcoltext="greentext"
                overnumb={
                  DepartmentsOverView.pets ? DepartmentsOverView.pets : 0
                }
              />
              <BoxDiv
                boximg={box1}
                ovradcls="chillibg"
                ovrtxt="Appointments Today"
                boxcoltext="ciltext"
                overnumb={DepartmentsOverView.appointments}
              />
            </div>
          </div>

          <div className="DepartWeekGraph">
            <div className="DashGraphCard">
              <div className="GraphTop">
                <h5>Appointments</h5>
                <ListSelect
                  options={optionsList1}
                  onChange={DepartmentBasisAppointmentGraph}
                />
              </div>
              <div className="graphimg">
                <DepartmentAppointmentsChart data={graphData} />
              </div>
            </div>

            <div className="DashGraphCard">
              <WeeklyAppointmentsChart data={WeeklyAppointmentGraph} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DepartmentsMain;
