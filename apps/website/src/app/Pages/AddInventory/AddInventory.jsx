// eslint-disable-next-line no-unused-vars
import React, { useEffect, useState } from 'react';
import './AddInventory.css';
import { Col, Container, Form, Row } from 'react-bootstrap';
import { Forminput } from '../SignUp/SignUp';
import DynamicSelect from '../../Components/DynamicSelect/DynamicSelect';
import DynamicDatePicker from '../../Components/DynamicDatePicker/DynamicDatePicker';
import { MainBtn } from '../Appointment/page';
import whtcheck from '../../../../public/Images/whtcheck.png';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useAuth } from '../../context/useAuth';
import { useNavigate } from 'react-router-dom';

const AddInventory = () => {
  const { userId,onLogout } = useAuth();
  const navigate = useNavigate()
  // Select options

  const options1 = [
    { value: '1', label: 'Pharmaceuticals' },
    { value: '2', label: 'Medical Supplies' },
    { value: '3', label: 'Pet Care Products' },
    { value: '4', label: 'Diagnostics' },
    { value: '5', label: 'Equipments' },
    { value: '6', label: 'Diagnostic Supplies' },
    { value: '7', label: 'Office Supplies' },
  ];
  const options2 = [
    { value: '1', label: 'Pfizer' },
    { value: '2', label: 'Johnson & Johnson' },
    { value: '3', label: 'Merck & Co' },
    { value: '4', label: 'Novartis' },
    { value: '5', label: 'GlaxoSmithKline (GSK)' },
    { value: '6', label: 'Sanofi' },
    { value: '7', label: 'AstraZeneca' },
  ];
  const options3 = [
    { value: '1', label: 'Tablet' },
    { value: '2', label: 'Capsule' },
    { value: '3', label: 'Syrup' },
    { value: '4', label: 'Suspension' },
    { value: '5', label: 'Ointment' },
    { value: '6', label: 'Inhaler' },
    { value: '7', label: 'Rectal Suppository' },
  ];
  const [inventoryData, setInventoryData] = useState({
    category: '',
    barcode: '',
    itemName: '',
    genericName: '',
    manufacturer: '',
    itemCategory: '',
    batchNumber: '',
    sku: '',
    strength: '',
    quantity: '',
    expiryDate: '',
    manufacturerPrice: '',
    markup: '',
    price: '',
    stockReorderLevel: '',
  });
  useEffect(() => {
    setInventoryData((prevData) => ({
      ...prevData,
      price: (
        Number(inventoryData.manufacturerPrice) +
        (Number(inventoryData.manufacturerPrice) *
          Number(inventoryData.markup)) /
          100
      ).toFixed(2),
    }));
  }, [inventoryData.manufacturerPrice, inventoryData.markup]);
  const handleChange = (e) => {
    const { name, value } = e.target;
    setInventoryData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSubmit = async () => {
    try {
      const token = sessionStorage.getItem("token");
      const response = await axios.post(
        `${process.env.NX_PUBLIC_VITE_BASE_URL}api/inventory/addInventory?userId=${userId}`,
        inventoryData,{headers:{Authorization: `Bearer ${token}`}},
      );
      if (response) {
        Swal.fire({
          title: 'Success',
          text: 'Inventory Added Successfully',
          icon: 'success',
        });
      }
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('Session expired. Redirecting to signin...');
        onLogout(navigate);
      }
      Swal.fire({
        title: "Failed",
        text:'Falied To Add Inventory',
        icon: "error",
      })
    }
  };

  return (
    <section className="AddInventorySec">
      <Container>
        <div className="AddInventorydata">
          <div className="TopAdinvtHead">
            <h3>
              <span>Add </span> Inventory
            </h3>
          </div>

          <div className="AddInventoryBox">
            <Form>
              <Row>
                <Col md={6}>
                  <DynamicSelect
                    options={options1}
                    placeholder="Select Category"
                    inname="category"
                    value={inventoryData.category}
                    onChange={(e) =>
                      setInventoryData((prevData) => ({
                        ...prevData,
                        category: e,
                      }))
                    }
                  />
                </Col>
                <Col md={6}>
                  <Forminput
                    inlabel="Bar Code"
                    intype="text"
                    inname="barcode"
                    onChange={handleChange}
                    value={inventoryData.barcode}
                  />
                </Col>
              </Row>
              <Row>
                <Col md={6}>
                  <Forminput
                    inlabel="Item Name"
                    intype="text"
                    inname="itemName"
                    onChange={handleChange}
                    value={inventoryData.itemName}
                  />
                </Col>
                <Col md={6}>
                  <Forminput
                    inlabel="Generic Name"
                    intype="text"
                    inname="genericName"
                    onChange={handleChange}
                    value={inventoryData.genericName}
                  />
                </Col>
              </Row>
              <Row>
                <Col md={6}>
                  <DynamicSelect
                    options={options2}
                    placeholder="Manufacturer"
                    inname="manufacturer"
                    value={inventoryData.manufacturer}
                    onChange={(e) =>
                      setInventoryData((prevData) => ({
                        ...prevData,
                        manufacturer: e,
                      }))
                    }
                  />
                </Col>
                <Col md={6}>
                  <DynamicSelect
                    options={options3}
                    placeholder="Item Category (like Tablet, Syrup, etc)"
                    inname="itemCategory"
                    value={inventoryData.itemCategory}
                    onChange={(e) =>
                      setInventoryData((prevData) => ({
                        ...prevData,
                        itemCategory: e,
                      }))
                    }
                  />
                </Col>
              </Row>
              <Row>
                <Col md={3}>
                  <Forminput
                    inlabel="Batch Number"
                    intype="number"
                    inname="batchNumber"
                    onChange={handleChange}
                    value={inventoryData.batchNumber}
                  />
                </Col>
                <Col md={3}>
                  <Forminput
                    inlabel="SKU"
                    intype="text"
                    inname="sku"
                    onChange={handleChange}
                    value={inventoryData.sku}
                  />
                </Col>
                <Col md={3}>
                  <Forminput
                    inlabel="Strength (ex: 500mg)"
                    intype="text"
                    inname="strength"
                    onChange={handleChange}
                    value={inventoryData.strength}
                  />
                </Col>
                <Col md={3}>
                  <Forminput
                    inlabel="Quantity"
                    intype="number"
                    inname="quantity"
                    onChange={handleChange}
                    value={inventoryData.quantity}
                  />
                </Col>
              </Row>
              <Row>
                <Col md={4}>
                  <Forminput
                    inlabel="$ Manufacturer Price"
                    intype="number"
                    inname="manufacturerPrice"
                    onChange={handleChange}
                    value={inventoryData.manufacturerPrice}
                  />
                </Col>
                <Col md={4}>
                  <Forminput
                    inlabel="% Markup"
                    intype="number"
                    inname="markup"
                    onChange={handleChange}
                    value={inventoryData.markup}
                  />
                </Col>
                <Col md={4}>
                  <Forminput
                    inlabel="$ Price"
                    intype="number"
                    inname="price"
                    value={inventoryData.price}
                  />
                </Col>
              </Row>
              <Row>
                <Col md={6}>
                  <Forminput
                    inlabel="Stock Reorder Level"
                    intype="text"
                    inname="stockReorderLevel"
                    onChange={handleChange}
                    value={inventoryData.stockReorderLevel}
                  />
                </Col>
                <Col md={6}>
                  <DynamicDatePicker
                    placeholder="Expiry Date (dd--mm-yyyy)"
                    inname="expiryDate"
                    onDateChange={(e) =>
                      setInventoryData((prevData) => ({
                        ...prevData,
                        expiryDate: e,
                      }))
                    }
                    value={inventoryData.expiryDate}
                  />
                </Col>
              </Row>
            </Form>
          </div>

          <div className="ee">
            <MainBtn
              bimg={whtcheck}
              btext="Add Inventory"
              onClick={handleSubmit}
            />
          </div>
        </div>
      </Container>
    </section>
  );
};

export default AddInventory;
