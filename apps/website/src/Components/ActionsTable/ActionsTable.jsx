import React, { useState } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
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
  const itemsPerPage = 6;
  const [offset, setOffset] = useState(0);
  const [visibleCount, setVisibleCount] = useState(itemsPerPage);

  const handleNext = () => {
    const newOffset = offset + itemsPerPage;
    if (newOffset < total) {
      setOffset(newOffset);
      setVisibleCount((prev) => Math.min(prev + itemsPerPage, total));
      onClick(newOffset, itemsPerPage, userId);
    }
  };

  const handlePrev = () => {
    const newOffset = offset - itemsPerPage;
    if (newOffset >= 0) {
      setOffset(newOffset);
      setVisibleCount((prev) => Math.max(prev - itemsPerPage, itemsPerPage));
      onClick(newOffset, itemsPerPage, userId);
    }
  };

  const handleAccept = (id, status, offset) => {
    onClicked(id, status, offset);
  };

  const handleCancel = (id, status, offset) => {
    onClicked(id, status, offset);
  };

  let data = [];
  if (location.pathname === "/dashboard") {
    data = appointments.slice(0, 3);
  } else {
    data = appointments;
  }

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
          {data.map((appointment, index) => (
            <tr key={index}>
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
                    onClick={() => handleAccept(appointment._id, "booked", offset)}
                  >
                    <img src={actimg1} alt="Accept" />
                  </Link>
                  <Link
                    onClick={() => handleCancel(appointment._id, "cancelled", offset)}
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
      {location.pathname !== "/dashboard" && (
        <div className="PaginationDiv">
          <button onClick={handlePrev} disabled={offset === 0}>
            <i className="ri-arrow-left-line"></i>
          </button>
          <h6 className="PagiName">
            Responses <span>{visibleCount} of {total}</span>
          </h6>
          <button
            onClick={handleNext}
            disabled={offset + itemsPerPage >= total}
          >
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
  onClicked: PropTypes.func.isRequired,
  total: PropTypes.number.isRequired,
};

export default ActionsTable;
