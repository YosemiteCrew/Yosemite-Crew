import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
// import pet1 from '../../../../public/Images/pet1.png';
// import pet2 from '../../../../public/Images/pet2.png';
// import pet3 from '../../../../public/Images/pet3.png';

const ActionsTable = ({
  appointments = [],
  actimg1,
  actimg2,
  onClick,
  onClicked,
}) => {
  const itemsPerPage = 5; // Should match the backend limit
  const [offset, setOffset] = useState(0); // Tracks the current offset

  console.log('actiontable', appointments);

  const handleNext = () => {
    setOffset((prevOffset) => prevOffset + itemsPerPage);
    onClick(offset + itemsPerPage); // Fetch next set of data
  };

  const handlePrev = () => {
    if (offset > 0) {
      setOffset((prevOffset) => prevOffset - itemsPerPage);
      onClick(offset - itemsPerPage); // Fetch previous set of data
    }
  };

  const handleAccept = (id, status, offset) => {
    onClicked(id, status, offset);
  };
  const handleCancel = (id, status, offset) => {
    onClicked(id, status, offset);
  };

  return (
    <div className="MainTableDiv">
      <table className="Appointtable">
        <thead>
          <tr>
            <th></th>
            <th>Name</th>
            <th>Appointment ID</th>
            <th>Reason for Appointment</th>
            <th>Pet Type</th>
            <th>Breed</th>
            <th>Date</th>
            <th>Doctor</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {appointments.map((appointment, index) => (
            <tr key={index}>
              <td>
                <div className="dogimg">
                  <img src={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/pet1.png`} alt={appointment.petName} />
                </div>
              </td>
              <td>
                <div className="tblDiv">
                  <h4>{appointment.petName}</h4>
                  <p>
                    <i className="ri-user-fill"></i> {appointment.ownerName}
                  </p>
                </div>
              </td>
              <td>{appointment.tokenNumber}</td>
              <td>{appointment.purposeOfVisit}</td>
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
                  <h4>{appointment.veterinarian}</h4>
                  <p>{appointment.department}</p>
                </div>
              </td>
              <td>
                <div className="actionDiv">
                  <Link
                    onClick={() => handleAccept(appointment._id, 1, offset)}
                  >
                    <img src={actimg1} alt="Accept" />
                  </Link>
                  <Link
                    onClick={() => handleCancel(appointment._id, 2, offset)}
                  >
                    <img src={actimg2} alt="Decline" />
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination Controls */}
      <div className="PaginationDiv">
        <button onClick={handlePrev} disabled={offset === 0}>
          <i className="ri-arrow-left-line"></i>
        </button>
        <h6 className="PagiName">
          Responses
          <span>
            {offset + 1} -{' '}
            {Math.min(offset + itemsPerPage, appointments.length)}
          </span>
        </h6>
        <button
          onClick={handleNext}
          disabled={appointments.length < itemsPerPage}
        >
          <i className="ri-arrow-right-line"></i>
        </button>
      </div>
    </div>
  );
};

ActionsTable.propTypes = {
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
      petImage: PropTypes.string.isRequired,
      acceptAction: PropTypes.string.isRequired,
      declineAction: PropTypes.string.isRequired,
    })
  ).isRequired,
  actimg1: PropTypes.string.isRequired,
  actimg2: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
};

export default ActionsTable;
