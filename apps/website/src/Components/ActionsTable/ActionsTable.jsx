import React, { useState } from "react";
import PropTypes from "prop-types";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/useAuth";

const ActionsTable = ({
  appointments = [],
  actimg1,
  actimg2,
  onClick,
  onClicked,
  total
}) => {
  const { userId } = useAuth();
  const { pathname } = useLocation();

  const itemsPerPage = 6;
  const [offset, setOffset] = useState(0);

  const isDashboard = pathname === "/dashboard";
  const paginatedAppointments = isDashboard
    ? appointments.slice(0, 3)
    : appointments;

  const visibleCount = isDashboard
    ? Math.min(3, appointments.length)
    : Math.min(offset + itemsPerPage, total);

  const handleNext = () => {
    const newOffset = offset + itemsPerPage;
    if (newOffset < total) {
      setOffset(newOffset);
      onClick(newOffset, itemsPerPage, userId);
    }
  };

  const handlePrev = () => {
    const newOffset = offset - itemsPerPage;
    if (newOffset >= 0) {
      setOffset(newOffset);
      onClick(newOffset, itemsPerPage, userId);
    }
  };

  const handleAction = (id, status) => {
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
          {paginatedAppointments.map((appointment) => (
            <tr key={appointment._id}>
              <td>
                <div className="dogimg">
                  <img
                    src={`${import.meta.env.VITE_BASE_IMAGE_URL}/pet1.png`}
                    alt={appointment.petName}
                  />
                </div>
              </td>
              <td>
                <div className="tblDiv">
                  <h4>{appointment.petName}</h4>
                  <p><i className="ri-user-fill"></i> {appointment.ownerName}</p>
                </div>
              </td>
              <td>{appointment.tokenNumber}</td>
              <td>{appointment.appointmentType}</td>
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
                  <Link onClick={() => handleAction(appointment._id, "booked")}>
                    <img src={actimg1} alt="Accept" />
                  </Link>
                  <Link onClick={() => handleAction(appointment._id, "cancelled")}>
                    <img src={actimg2} alt="Decline" />
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {!isDashboard && (
        <div className="PaginationDiv">
          <button onClick={handlePrev} disabled={offset === 0}>
            <i className="ri-arrow-left-line"></i>
          </button>
          <h6 className="PagiName">
            Responses <span>{visibleCount} of {total}</span>
          </h6>
          <button onClick={handleNext} disabled={offset + itemsPerPage >= total}>
            <i className="ri-arrow-right-line"></i>
          </button>
        </div>
      )}
    </div>
  );
};

ActionsTable.propTypes = {
  appointments: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string.isRequired,
      petName: PropTypes.string.isRequired,
      ownerName: PropTypes.string.isRequired,
      tokenNumber: PropTypes.string,
      purposeOfVisit: PropTypes.string,
      petType: PropTypes.string,
      breed: PropTypes.string,
      appointmentDate: PropTypes.string,
      appointmentTime: PropTypes.string,
      veterinarian: PropTypes.string,
      department: PropTypes.string,
    })
  ).isRequired,
  actimg1: PropTypes.string.isRequired,
  actimg2: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
  onClicked: PropTypes.func.isRequired,
  total: PropTypes.number.isRequired,
};

export default ActionsTable;
