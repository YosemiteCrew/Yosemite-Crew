import React, { useState } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/useAuth";

const AssessmentsTable = ({
  assessments = [],
  actimg1,
  actimg2,
  onClick,
  onClicked,
  total
}) => {
  const { userId } = useAuth();
  const itemsPerPage = 6; // Should match the backend limit
  const [offset, setOffset] = useState(0); // Tracks the current offset
  const [visibleCount, setVisibleCount] = useState(itemsPerPage);



  const handleNext = () => {
    const newOffset = offset + itemsPerPage;
    if (newOffset < total) {
      setOffset(newOffset);
      setVisibleCount((prev) => Math.min(prev + itemsPerPage, total));
      onClick(newOffset);
    }
  };

  const handlePrev = () => {
    const newOffset = offset - itemsPerPage;
    if (newOffset >= 0) {
      setOffset(newOffset);
      setVisibleCount((prev) => Math.max(prev - itemsPerPage, itemsPerPage));
      onClick(newOffset);
    }
  };

  const handleAccept = (id, status, offset) => {
    onClicked(id, status, offset);
  };
  const handleCancel = (id, status, offset) => {
    onClicked(id, status, offset);
  };

  let data = [];
  data = assessments;
 

  return (
    <div className="MainTableDiv">
      <table className="Appointtable">
        <thead>
          <tr>
            <th></th>
            <th>Name</th>
            <th>Assessment ID</th>
            <th>Pet Type</th>
            <th>Breed</th>
            <th>Type</th>
            <th>Doctor</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.map((assessment, index) => (
            <tr key={index}>
              <td>
                <div className="dogimg">
                  <img
                    src={`${import.meta.env.VITE_BASE_IMAGE_URL}/pet1.png`}
                    alt={ assessment?.petName}
                  />
                </div>
              </td>
              <td>
                <div className="tblDiv">
                  <h4>{assessment?.petName} </h4>
                  <p><i className="ri-user-fill"></i> {assessment?.ownerName}</p>
                 
                </div>
              </td>
              <td>{assessment?.assessmentId}</td>
              <td>{assessment?.petType}</td>
              <td>{assessment?.petBreed}</td>
             
              
              <td>{assessment.assessment_type}</td>

              
         
              <td>
                <div className="tblDiv">
                  <h4>{assessment?.doctorName} </h4>
                  <p>{assessment.department}</p>
                </div>
              </td>
              <td>
                <div className="actionDiv">
                  <Link
                    onClick={() => handleAccept(assessment.id, "Confirmed", offset)}
                  >
                    <img src={actimg1} alt="Accept" />
                  </Link>
                  <Link
                    onClick={() => handleCancel(assessment.id,"Cancelled", offset)}
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

AssessmentsTable.propTypes = {
  assessments: PropTypes.arrayOf(
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

export default AssessmentsTable;
