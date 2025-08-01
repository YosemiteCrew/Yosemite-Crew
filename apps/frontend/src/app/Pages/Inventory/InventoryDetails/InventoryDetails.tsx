'use client';
import React, { useState } from 'react';
import "./InventoryDetails.css"
import { Button, Card, Col, Container, Form, ProgressBar, Row } from 'react-bootstrap';
import { Icon } from '@iconify/react/dist/iconify.js';

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
                <Button onClick={() => setEditMode(!editMode)}><Icon icon="solar:pen-bold" width="14" height="14" color='#247AED' />{editMode ? 'Cancel Edit' : 'Edit Details'}</Button>
            </div>

            <Card className="InvtDetailCard">
            
                {/* Basic Info */}
              <div className="BasicInvt">
                <h5>Basic</h5>
                <div className="BasicGrid">
                    {['category', 'itemName', 'genericName', 'itemCategory', 'manufacturer'].map((key, i) => (
                    <div key={i} className='BasicItems'>
                        <p>{capitalize(key)}</p>
                        {editMode ? (
                        <Form.Control name={key} value={item[key as keyof InventoryItem] as string} onChange={handleChange} />
                        ) : (
                        <h6>{item[key as keyof InventoryItem]}</h6>
                        )}
                    </div>
                    ))}
                </div>
              </div>
                

                <hr />
                {/* Stock Info */}
                <div className="BasicInvt">
                  <h5>Stock</h5>
                  <div className="BasicGrid">
                    <div className='BasicItems'>
                      <p>Batch Number</p>
                      <h6>{item.batchNumber}</h6>
                    </div>

                    <div className='BasicItems'>
                      <p>SKU</p>
                      <h6>{item.sku}</h6>
                    </div>

                    <div className='BasicItems'>
                      <p>Strength</p>
                      <h6>{item.strength}</h6>
                    </div>

                    <div className='BasicItems'>
                      <p>Expiry Date</p>
                      {editMode ? (
                          <Form.Control
                          type="date"
                          name="expiryDate"
                          value={item.expiryDate}
                          onChange={handleChange}
                          />
                      ) : (
                          <h6>{formatDate(item.expiryDate)}</h6>
                      )}
                    </div>
                    <div className='BasicItems'>
                      <p>Manufacturer</p>
                      <h6>{item.manufacturer}</h6>
                    </div>
                  </div>
                  <div className="BasicGrid">
                      <div className='BasicItems'>
                        <p>Total Stock</p>
                        <h6>{item.totalStock}</h6>
                      </div>
                      <div className='BasicItems'>
                        <p>Available Stock</p>
                        <h6>{item.availableStock}</h6>
                      </div>
                      <div className='BasicItems'>
                        <p>Stock Reorder Level</p>
                        <h6>{item.reorderLevel}</h6>
                      </div>
                      <div className='BasicItems'>
                        <p>Status</p>
                        <h6 className="text-success">● Available</h6>
                      </div>
                  </div>

                  <div className="">
                      <div className="d-flex justify-content-between">
                      <span>Remaining</span>
                      <span>{stockPercentage}%</span>
                      </div>
                      <ProgressBar now={stockPercentage} variant="success" />
                  </div>

                </div>

                  <hr />

                {/* Pricing */}
                <div className="BasicInvt">
                  <h5>Pricing</h5>
                  <div className="BasicGrid">
                      <div className='BasicItems'>
                        <p>Manufacturer Price</p>
                        {editMode ? (
                            <Form.Control
                            type="number"
                            name="manufacturerPrice"
                            value={item.manufacturerPrice}
                            onChange={handleChange}
                            />
                        ) : (
                            <h6>${item.manufacturerPrice.toFixed(2)}</h6>
                        )}
                      </div>
                      <div className='BasicItems'>
                        <p>Markup Percentage</p>
                        {editMode ? (
                            <Form.Control
                            type="number"
                            name="markupPercentage"
                            value={item.markupPercentage}
                            onChange={handleChange}
                            />
                        ) : (
                            <h6>% {item.markupPercentage}</h6>
                        )}
                      </div>
                      <div className='BasicItems'>
                        <p>Price</p>
                        <h6>${sellingPrice}</h6>
                      </div>
                  </div>
                </div>
            
            </Card>

            {editMode && (
              <div className="InvtUpdateBtn">
                <Button onClick={() => setEditMode(false)}><Icon icon="carbon:checkmark-filled" width="24" height="24" /> Update </Button>
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
