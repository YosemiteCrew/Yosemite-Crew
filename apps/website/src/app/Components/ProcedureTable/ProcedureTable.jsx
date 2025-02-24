// eslint-disable-next-line no-unused-vars
// import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

const ProcedureTable = ({
  procedureData = [],
  actimg1,
  actimg2,
  procedureTotalPages,
  setProcedureCurrentPage,
  procedureCurrentPage,
}) => {
  console.log('procedureData', procedureData);
  // Fallback data if appointments prop is not provided
  const handleNext = () => {
    if (procedureCurrentPage < procedureTotalPages) {
      setProcedureCurrentPage(procedureCurrentPage + 1);
    }
  };

  const handlePrev = () => {
    if (procedureCurrentPage > 1) {
      setProcedureCurrentPage(procedureCurrentPage - 1);
    }
  };

  return (
    <div className="MainTableDiv">
      <table className="Prceduretable">
        <thead>
          <tr>
            <th scope="col"></th>
            <th scope="col">Name</th>
            <th scope="col">Category</th>
            <th scope="col">Items</th>
            <th scope="col">Total Cost</th>
            {/* <th scope="col">Created by</th> */}
            <th scope="col">Last updated</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {procedureData?.map((procedure, index) => (
            <tr key={index} style={{ alignItems: 'center' }}>
              <td scope="row">
                <div className="proceicon ">
                  <i className="ri-checkbox-blank-circle-fill"></i>
                </div>
              </td>
              <td>
                <strong>{procedure.name}</strong>
              </td>
              <td>
                <strong> {procedure.category}</strong>
              </td>
              <td>
                <strong>{procedure.item}</strong>
              </td>
              <td>
                <strong>{procedure.totalcost}</strong>
              </td>
              {/* <td>
                <strong>{procedure.created}</strong>
              </td> */}
              <td>
                <strong>{procedure.lstupdte}</strong>
              </td>

              <td>
                <div className="actionDiv">
                  <Link to={procedure.acceptAction}>
                    {' '}
                    <img src={actimg1} alt="Accept" />
                  </Link>
                  <Link to={procedure.declineAction}>
                    {' '}
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
        <button onClick={handlePrev} disabled={procedureCurrentPage === 1}>
          <i className="ri-arrow-left-line"></i>
        </button>
        <h6 className="PagiName">
          Page <span>{procedureCurrentPage}</span> of{' '}
          <span>{procedureTotalPages}</span>
        </h6>
        <button
          onClick={handleNext}
          disabled={procedureCurrentPage >= procedureTotalPages}
        >
          <i className="ri-arrow-right-line"></i>
        </button>
      </div>
    </div>
  );
};

ProcedureTable.propTypes = {
  actimg1: PropTypes.string.isRequired,
  actimg2: PropTypes.string.isRequired,
  procedures: PropTypes.arrayOf(
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
  ),
};

export default ProcedureTable;
