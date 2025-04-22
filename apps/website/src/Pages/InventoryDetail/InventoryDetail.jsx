import React, { useCallback, useEffect, useState } from "react";
import "./InventoryDetail.css";
import { Container } from "react-bootstrap";
import { BiSolidEditAlt } from "react-icons/bi";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import axios from "axios";
import ProgressBar from "react-bootstrap/ProgressBar";
import PropTypes from "prop-types";
// import whtcheck from '../../../../public/Images/whtcheck.png';
import { MainBtn } from "../Appointment/page";
import { InventoryFHIRParser } from "../../utils/InventoryFHIRMapper";
import Swal from "sweetalert2";

function InventoryDetail() {
  const { userId, onLogout } = useAuth();
  const navigate = useNavigate();
  const itemId = useParams().id; // Extract itemId correctly
  const [itemDetails, setItemDetails] = useState(null);
  console.log("itemId", itemId);

  const fetchItemDetails = useCallback(async () => {
    if (!itemId) return;

    try {
      const token = sessionStorage.getItem("token");
      const response = await axios.get(
        `${import.meta.env.VITE_BASE_URL}fhir/v1/InventoryReport`,
        {
          params: { userId, itemId },
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const newdata = InventoryFHIRParser.fromFHIR(response.data);

      console.log("newdata", newdata);
      setItemDetails(newdata);
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log("Session expired. Redirecting to signin...");
        onLogout(navigate);
      } else if (error.response && error.response.status === 500) {
        const fhirError = error.response.data;
        const message =
          fhirError?.issue?.[0]?.details?.text ||
          fhirError?.issue?.[0]?.diagnostics ||
          "Internal Server Error";
    
        Swal.fire({
          icon: 'error',
          title: 'Server Error',
          text: message,
        });
      } else if (error.response && error.response.status === 400) {
        const fhirError = error.response.data;
        const message =
          fhirError?.issue?.[0]?.details?.text ||
          fhirError?.issue?.[0]?.diagnostics ||
          "Bad Request";
    
        Swal.fire({
          icon: 'warning',
          title: 'Validation Error',
          text: message,
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Unexpected Error',
          text: error.message || "An unknown error occurred",
        });
      }    
    }
  }, [userId, navigate, onLogout, itemId]);

  useEffect(() => {
   if(userId && itemId) {
    fetchItemDetails();
   }
  }, [itemId, userId, fetchItemDetails]);

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
                <Dtlitems dpara="Category" dname={itemDetails?.category} />
                <Dtlitems dpara="Item Name" dname={itemDetails?.itemName} />
                <Dtlitems
                  dpara="Generic Name"
                  dname={itemDetails?.genericName}
                />
                <Dtlitems
                  dpara="Item Category"
                  dname={itemDetails?.itemCategory}
                />
                <Dtlitems
                  dpara="Manufacturer"
                  dname={itemDetails?.manufacturer}
                />
              </div>
            </div>

            <div className="detaildivInner">
              <h5>Stock</h5>
              <div className="baskdetail">
                <Dtlitems
                  dpara="Batch Number"
                  dname={itemDetails?.batchNumber}
                />
                <Dtlitems dpara="SKU" dname={itemDetails?.sku} />
                <Dtlitems dpara="Strength" dname={itemDetails?.strength} />
                <Dtlitems
                  dpara="Expiry Date"
                  dname={new Date(itemDetails?.expiryDate).toDateString()}
                />
              </div>
              <div className="baskdetail">
                <Dtlitems dpara="Total Stock" dname={itemDetails?.quantity} />
                <Dtlitems
                  dpara="Stock Reorder Level"
                  dname={itemDetails?.stockReorderLevel}
                />
                <Dtlitems
                  dpara="Status"
                  dname={
                    itemDetails?.quantity < itemDetails?.stockReorderLevel
                      ? "Low Stock"
                      : "Available"
                  }
                />
              </div>
              <div className="detailprogbar">
                <p>Remaining</p>
                <ProgressBar
                  now={
                    (itemDetails?.quantity / itemDetails?.stockReorderLevel) *
                    100
                  }
                />
                <h6>
                  {Math.round(
                    (itemDetails?.quantity / itemDetails?.stockReorderLevel) *
                      100
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
                  dname={`$ ${itemDetails?.manufacturerPrice}`}
                />
                <Dtlitems
                  dpara="Markup Percentage"
                  dname={`% ${itemDetails?.markup}`}
                />
                <Dtlitems dpara="Price" dname={`$ ${itemDetails?.price}`} />
              </div>
            </div>
          </div>

          <div className="ee">
            <MainBtn
              bimg={`${import.meta.env.VITE_BASE_IMAGE_URL}/whtcheck.png`}
              btext="Update"
              optclas=""
            />
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
