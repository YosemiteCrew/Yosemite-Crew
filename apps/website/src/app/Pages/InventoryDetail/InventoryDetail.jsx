import React, { useEffect, useState } from 'react';
import './InventoryDetail.css';
import { Container } from 'react-bootstrap';
import { BiSolidEditAlt } from 'react-icons/bi';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import axios from 'axios';
import ProgressBar from 'react-bootstrap/ProgressBar';
import PropTypes from 'prop-types';
import whtcheck from '../../../../public/Images/whtcheck.png';
import { MainBtn } from '../Appointment/page';

function InventoryDetail() {
  const location = useLocation();
  const { userId } = useAuth();
  const itemId = location.state?.itemData; // Extract itemId correctly
  const [itemDetails, setItemDetails] = useState(null);

  const fetchItemDetails = async () => {
    if (!itemId) return; // Prevent API call if itemId is undefined

    try {
      const response = await axios.get(
        `${process.env.NX_PUBLIC_VITE_BASE_URL}api/inventory/getToViewItemsDetaild`,
        { params: { userId, itemId } }
      );
      console.log('Fetched Data:', response.data.inventory);
      setItemDetails(response.data.inventory[0]); // Store the first object in state
    } catch (error) {
      console.error('Error fetching inventory details:', error);
    }
  };

  useEffect(() => {
    fetchItemDetails();
  }, [itemId, userId]);

  if (!itemDetails) {
    return <p>Loading...</p>; // Show loading state while fetching
  }

  return (
    <section className="InventoryDetailsSec">
      <Container>
        <div className="InventoryDetailsdata">
          <div className="TopDetailHead">
            <h3>
              <span>Item</span> Detail
            </h3>
            <Link to="#">
              <span>
                <BiSolidEditAlt />
              </span>
              Edit Details
            </Link>
          </div>

          <div className="InventoryDetailsBox">
            <div className="detaildivInner">
              <h5>Basic</h5>
              <div className="baskdetail">
                <Dtlitems dpara="Category" dname={itemDetails.category} />
                <Dtlitems dpara="Item Name" dname={itemDetails.itemName} />
                <Dtlitems
                  dpara="Generic Name"
                  dname={itemDetails.genericName}
                />
                <Dtlitems
                  dpara="Item Category"
                  dname={itemDetails.itemCategory}
                />
                <Dtlitems
                  dpara="Manufacturer"
                  dname={itemDetails.manufacturer}
                />
              </div>
            </div>

            <div className="detaildivInner">
              <h5>Stock</h5>
              <div className="baskdetail">
                <Dtlitems
                  dpara="Batch Number"
                  dname={itemDetails.batchNumber}
                />
                <Dtlitems dpara="SKU" dname={itemDetails.sku} />
                <Dtlitems dpara="Strength" dname={itemDetails.strength} />
                <Dtlitems
                  dpara="Expiry Date"
                  dname={new Date(itemDetails.expiryDate).toDateString()}
                />
              </div>
              <div className="baskdetail">
                <Dtlitems dpara="Total Stock" dname={itemDetails.quantity} />
                <Dtlitems
                  dpara="Stock Reorder Level"
                  dname={itemDetails.stockReorderLevel}
                />
                <Dtlitems
                  dpara="Status"
                  dname={
                    itemDetails.quantity < itemDetails.stockReorderLevel
                      ? 'Low Stock'
                      : 'Available'
                  }
                />
              </div>
              <div className="detailprogbar">
                <p>Remaining</p>
                <ProgressBar
                  now={
                    (itemDetails.quantity / itemDetails.stockReorderLevel) * 100
                  }
                />
                <h6>
                  {Math.round(
                    (itemDetails.quantity / itemDetails.stockReorderLevel) * 100
                  )}
                  %
                </h6>
              </div>
            </div>

            <div className="detaildivInner">
              <h5>Pricing</h5>
              <div className="baskdetail">
                <Dtlitems
                  dpara="Manufacturer Price"
                  dname={`$ ${itemDetails.manufacturerPrice}`}
                />
                <Dtlitems
                  dpara="Markup Percentage"
                  dname={`% ${itemDetails.markup}`}
                />
                <Dtlitems dpara="Price" dname={`$ ${itemDetails.price}`} />
              </div>
            </div>
          </div>

          <div className="ee">
            <MainBtn bimg={whtcheck} btext="Update" optclas="" />
          </div>
        </div>
      </Container>
    </section>
  );
}

export default InventoryDetail;

// Dtlitems Component
function Dtlitems({ dpara, dname }) {
  return (
    <div className="dtlinr">
      <p>{dpara}</p>
      <h6>{dname}</h6>
    </div>
  );
}

Dtlitems.propTypes = {
  dpara: PropTypes.string.isRequired,
  dname: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
};
