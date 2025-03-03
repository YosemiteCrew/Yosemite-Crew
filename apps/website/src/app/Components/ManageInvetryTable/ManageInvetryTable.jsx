import React from 'react';
import PropTypes from 'prop-types';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from 'react-bootstrap';

const ManageInvetryTable = ({
  inventoryData = [],
  actimg1,
  actimg2,
  currentPage,
  setCurrentPage,
  totalPages,
}) => {
  const navigate = useNavigate();
  // Handlers for pagination
  const handleNext = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrev = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };
  const viewDetails = (item) => {
    navigate(`/inventorydetails/${item}`);
  };
  return (
    <div className="MainTableDiv">
      <table className="MangeInvttable">
        <thead>
          <tr>
            <th scope="col"></th>
            <th scope="col">Name</th>
            <th scope="col">Generic Name</th>
            <th scope="col">SKU</th>
            <th scope="col">Strength</th>
            <th scope="col">Category</th>
            <th scope="col">Manufacturer</th>
            <th scope="col">Price</th>
            <th scope="col">Manufacturer Price</th>
            <th scope="col">Stock</th>
            <th scope="col">Expiry Date</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {inventoryData.length > 0 ? (
            inventoryData.map((item, index) => (
              <tr key={item._id || index}>
                <td>
                  <div className="proceicon">
                    {/* <i className="ri-checkbox-blank-circle-fill"></i> */}
                  </div>
                </td>
                <td>{item.itemName}</td>
                <td>{item.genericName}</td>
                <td>{item.sku}</td>
                <td>{item.strength}</td>
                <td>{item.itemCategory}</td>
                <td>{item.manufacturer}</td>
                <td>USD {item.price}</td>
                <td>USD {item.manufacturerPrice}</td>
                <td>
                  <div className="tblDiv">
                    <h4>{item.quantity}</h4>
                    <p>
                      <i className="ri-box-3-fill"></i> {item.stockReorderLevel}
                    </p>
                  </div>
                </td>
                <td>{new Date(item.expiryDate).toLocaleDateString()}</td>
                <td>
                  <div className="actionDiv">
                    <Button onClick={() => viewDetails(item._id)}>
                      <img src={actimg1} alt="Accept" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="12" className="text-center">
                No inventory data found.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Pagination Controls */}
      <div className="PaginationDiv">
        <button onClick={handlePrev} disabled={currentPage === 1}>
          <i className="ri-arrow-left-line"></i>
        </button>
        <h6 className="PagiName">
          Page <span>{currentPage}</span> of <span>{totalPages}</span>
        </h6>
        <button onClick={handleNext} disabled={currentPage >= totalPages}>
          <i className="ri-arrow-right-line"></i>
        </button>
      </div>
    </div>
  );
};

ManageInvetryTable.propTypes = {
  actimg1: PropTypes.string.isRequired,
  actimg2: PropTypes.string.isRequired,
  inventoryData: PropTypes.array.isRequired,
  currentPage: PropTypes.number.isRequired,
  setCurrentPage: PropTypes.func.isRequired,
  totalPages: PropTypes.number.isRequired,
};

export default ManageInvetryTable;
