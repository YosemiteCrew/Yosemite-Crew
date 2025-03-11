import React from 'react';
import PropTypes from 'prop-types'; 
import pet1 from "../../../../public/Images/pet1.png"; 

export function StatusTable({ appointments = [] }) {
  // Default appointment status list
  const appointmentsStatusList = [
    {
      id: 'DR001-03-23-2024',
      petName: 'Kizie',
      ownerName: 'Sky B',
      petType: 'Dog',
      breed: 'Beagle',
      appointmentDate: '01 Sep 2024',
      appointmentTime: '11:30 AM',
      doctorName: 'Dr. Emily Johnson',
      specialization: 'Cardiology',
      status: 'Pending', // Will map to "pending" class
      petImage: pet1,
    },
    {
      id: 'DR002-03-23-2024',
      petName: 'Oscar',
      ownerName: 'Pika K',
      petType: 'Cat',
      breed: 'Egyptian Mau',
      appointmentDate: '01 Sep 2024',
      appointmentTime: '12:00 PM',
      doctorName: 'Dr. David Brown',
      specialization: 'Gastroenterology',
      status: 'Complete', // Will map to "complete" class
      petImage: pet1,
    },
    {
      id: 'DR003-03-23-2024',
      petName: 'King',
      ownerName: 'Henry C',
      petType: 'Horse',
      breed: 'Paso Finos',
      appointmentDate: '01 Sep 2024',
      appointmentTime: '01:00 PM',
      doctorName: 'Dr. Megan Clark',
      specialization: 'Endocrinology',
      status: 'Pending', // Will map to "pending" class
      petImage: pet1,
    },
  ];

  // Use the provided appointments or fallback to the default list
  const displayedAppointments = appointments.length ? appointments : appointmentsStatusList;

  return (
    <div className="DashActionTable">
      <div className="MianTableDiv">
        <table className="Appointtable">
          <thead>
            <tr>
              <th scope="col"></th>
              <th scope="col">Name</th>
              <th scope="col">Appointment ID</th>
              <th scope="col">Pet Type</th>
              <th scope="col">Breed</th>
              <th scope="col">Date</th>
              <th scope="col">Doctor</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {displayedAppointments.map((appointment, index) => (
              <tr key={index}>
                <th scope="row">
                  <div className="dogimg">
                    <img src={appointment.petImage} alt={appointment.petName} />
                  </div>
                </th>
                <td>
                  <div className="tblDiv">
                    <h4>{appointment.petName}</h4>
                    <p><i className="ri-user-fill"></i> {appointment.ownerName}</p>
                  </div>
                </td>
                <td>{appointment.id}</td>
                <td>{appointment.petType}</td>
                <td>{appointment.breed}</td>
                <td>
                  <div className="tblDiv">
                    <h4>{appointment.appointmentDate}</h4>
                    <p>{appointment.appointmentTime}</p>
                  </div>
                </td>
                <td>
                  <div className="tblDiv">
                    <h4>{appointment.doctorName}</h4>
                    <p>{appointment.specialization}</p>
                  </div>
                </td>
                <td>
                  <div className="StatusDiv">
                    <a className={appointment.status.toLowerCase()} href="dd">
                      {appointment.status}
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

StatusTable.propTypes = {
  appointments: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      petName: PropTypes.string.isRequired,
      ownerName: PropTypes.string.isRequired,
      petType: PropTypes.string.isRequired,
      breed: PropTypes.string.isRequired,
      appointmentDate: PropTypes.string.isRequired,
      appointmentTime: PropTypes.string.isRequired,
      doctorName: PropTypes.string.isRequired,
      specialization: PropTypes.string.isRequired,
      status: PropTypes.string.isRequired,
      petImage: PropTypes.string.isRequired,
    })
  ),
};

export default StatusTable;
