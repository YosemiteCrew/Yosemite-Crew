'use client';
import React, { useState } from 'react';
import "./InventoryDetails.css"
import { Button, Card, Col, Container, Form, ProgressBar, Row } from 'react-bootstrap';

type InventoryItem = {
  category: string;
  itemName: string;
  genericName: string;
  itemCategory: string;
  manufacturer: string;
  batchNumber: string;
  sku: string;
  strength: string;
  expiryDate: string;
  totalStock: number;
  availableStock: number;
  reorderLevel: number;
  manufacturerPrice: number;
  markupPercentage: number;
};

const defaultItem: InventoryItem = {
  category: 'Pharmaceuticals',
  itemName: 'Zimax',
  genericName: 'Azithromycin',
  itemCategory: 'Tablet',
  manufacturer: 'Zoetis',
  batchNumber: 'CMT241520',
  sku: 'UY3750',
  strength: '500mg',
  expiryDate: '2024-12-19',
  totalStock: 150,
  availableStock: 100,
  reorderLevel: 25,
  manufacturerPrice: 15.0,
  markupPercentage: 15,
};

const InventoryDetails: React.FC = () => {
  const [item, setItem] = useState<InventoryItem>(defaultItem);
  const [editMode, setEditMode] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setItem(prev => ({
      ...prev,
      [name]: name.includes('Stock') || name.includes('Price') || name.includes('Percentage') ? Number(value) : value
    }));
  };

  const sellingPrice = (item.manufacturerPrice + (item.manufacturerPrice * item.markupPercentage / 100)).toFixed(2);
  const stockPercentage = Math.round((item.availableStock / item.totalStock) * 100);

  return (
    <section className="InventoryDetailsSec">
      <Container>
        <div className="InventryData">

            <div className="InventryHeading">
                <h4>Item Details</h4>
                <Button variant="outline-dark" size="sm" onClick={() => setEditMode(!editMode)}>
                ✏️ {editMode ? 'Cancel Edit' : 'Edit Details'}
                </Button>
            </div>

            <Card className="">
            
                <hr />

                {/* Basic Info */}
                <h6>Basic</h6>
                <Row className="mb-4">
                    {['category', 'itemName', 'genericName', 'itemCategory', 'manufacturer'].map((key, i) => (
                    <Col md={2} key={i}>
                        <div className="mb-2 fw-semibold">{capitalize(key)}</div>
                        {editMode ? (
                        <Form.Control name={key} value={item[key as keyof InventoryItem] as string} onChange={handleChange} />
                        ) : (
                        <div>{item[key as keyof InventoryItem]}</div>
                        )}
                    </Col>
                    ))}
                </Row>

                <hr />

                {/* Stock Info */}
                <h6>Stock</h6>
                <Row className="mb-3">
                    <Col md={2}><strong>Batch Number</strong><div>{item.batchNumber}</div></Col>
                    <Col md={2}><strong>SKU</strong><div>{item.sku}</div></Col>
                    <Col md={2}><strong>Strength</strong><div>{item.strength}</div></Col>
                    <Col md={3}>
                    <strong>Expiry Date</strong>
                    {editMode ? (
                        <Form.Control
                        type="date"
                        name="expiryDate"
                        value={item.expiryDate}
                        onChange={handleChange}
                        />
                    ) : (
                        <div>{formatDate(item.expiryDate)}</div>
                    )}
                    </Col>
                    <Col md={3}><strong>Manufacturer</strong><div>{item.manufacturer}</div></Col>
                </Row>
                <Row>
                    <Col md={2}><strong>Total Stock</strong><div>{item.totalStock}</div></Col>
                    <Col md={2}><strong>Available Stock</strong><div>{item.availableStock}</div></Col>
                    <Col md={3}><strong>Stock Reorder Level</strong><div>{item.reorderLevel}</div></Col>
                    <Col md={3}><strong>Status</strong><div className="text-success">● Available</div></Col>
                </Row>

                <div className="mt-3">
                    <div className="d-flex justify-content-between">
                    <span>Remaining</span>
                    <span>{stockPercentage}%</span>
                    </div>
                    <ProgressBar now={stockPercentage} variant="success" />
                </div>

                <hr />

                {/* Pricing */}
                <h6>Pricing</h6>
                <Row className="mb-3">
                    <Col md={3}>
                    <strong>Manufacturer Price</strong>
                    {editMode ? (
                        <Form.Control
                        type="number"
                        name="manufacturerPrice"
                        value={item.manufacturerPrice}
                        onChange={handleChange}
                        />
                    ) : (
                        <div>${item.manufacturerPrice.toFixed(2)}</div>
                    )}
                    </Col>
                    <Col md={3}>
                    <strong>Markup Percentage</strong>
                    {editMode ? (
                        <Form.Control
                        type="number"
                        name="markupPercentage"
                        value={item.markupPercentage}
                        onChange={handleChange}
                        />
                    ) : (
                        <div>% {item.markupPercentage}</div>
                    )}
                    </Col>
                    <Col md={3}>
                    <strong>Price</strong>
                    <div>${sellingPrice}</div>
                    </Col>
                </Row>

            
            </Card>

            {editMode && (
                <div className="text-center mt-4">
                <Button variant="dark" onClick={() => setEditMode(false)}>
                    ✅ Update
                </Button>
                </div>
            )}

        </div>
      </Container>
    </section>
  );
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/([A-Z])/g, ' $1');
const formatDate = (date: string) => new Date(date).toLocaleDateString('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric'
});

export default InventoryDetails;
