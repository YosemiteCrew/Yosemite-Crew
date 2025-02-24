import React, { useState, useEffect, useCallback } from 'react';
import { Table, Button, Form } from 'react-bootstrap';
import { AiFillPlusCircle } from 'react-icons/ai';
import { FiEdit3 } from 'react-icons/fi';
import { RiDeleteBin5Line } from 'react-icons/ri';
import { IoIosSave } from 'react-icons/io';
import { debounce } from 'lodash';

const PackageTable = ({ updatePackageItems }) => {
  const [rows, setRows] = useState([
    // {
    //   id: 1,
    //   name: 'Anesthesia',
    //   itemType: 'Service',
    //   quantity: 1,
    //   unitPrice: 150,
    //   subtotal: 150,
    //   notes: 'For general anesthesia use',
    // },
    // {
    //   id: 2,
    //   name: 'Surgical Pack',
    //   itemType: 'Medical Supplies',
    //   quantity: 1,
    //   unitPrice: 50,
    //   subtotal: 50,
    //   notes: 'Sterilized kit for surgery',
    // },
    // {
    //   id: 3,
    //   name: 'Pain Medication',
    //   itemType: 'Medicine',
    //   quantity: 3,
    //   unitPrice: 20,
    //   subtotal: 60,
    //   notes: 'Post-op pain management',
    // },
  ]);

  const [editRowId, setEditRowId] = useState(null);

  // Avoid unnecessary re-renders by using useCallback
  const debouncedUpdate = useCallback(
    debounce((updatedRows) => updatePackageItems(updatedRows), 300),
    []
  );

  useEffect(() => {
    debouncedUpdate(rows);
  }, [rows, debouncedUpdate]);

  // Use Date.now() for unique IDs
  const handleAddRow = useCallback(() => {
    const newRow = {
      id: Date.now(),
      name: '',
      itemType: '',
      quantity: 0,
      unitPrice: 0,
      subtotal: 0,
      notes: '',
    };
    setRows((prevRows) => [...prevRows, newRow]);
    setEditRowId(newRow.id);
  }, []);

  const handleInputChange = useCallback((e, id) => {
    const { name, value } = e.target;
    setRows((prevRows) =>
      prevRows.map((row) =>
        row.id === id
          ? {
              ...row,
              [name]:
                name === 'quantity' || name === 'unitPrice'
                  ? Number(value)
                  : value,
              subtotal:
                name === 'quantity' || name === 'unitPrice'
                  ? name === 'quantity'
                    ? Number(value) * row.unitPrice
                    : row.quantity * Number(value)
                  : row.subtotal,
            }
          : row
      )
    );
  }, []);

  const handleSaveRow = useCallback((id) => {
    setEditRowId(null);
  }, []);

  const handleDeleteRow = useCallback((id) => {
    setRows((prevRows) => prevRows.filter((row) => row.id !== id));
  }, []);

  return (
    <div className="PackageTableDiv">
      <div className="PackageHead">
        <h3>
          Package Items <span>({rows.length})</span>
        </h3>
        <Button onClick={handleAddRow}>
          <AiFillPlusCircle /> Add
        </Button>
      </div>
      <Table className="Packgetable">
        <thead>
          <tr>
            <th>Name</th>
            <th>Item Type</th>
            <th>quantity</th>
            <th>Unit Price</th>
            <th>Subtotal</th>
            <th>Notes</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {editRowId === row.id ? (
                <>
                  <td>
                    <Form.Control
                      type="text"
                      name="name"
                      value={row.name}
                      onChange={(e) => handleInputChange(e, row.id)}
                      placeholder="Enter name"
                    />
                  </td>
                  <td>
                    <Form.Control
                      type="text"
                      name="itemType"
                      value={row.itemType}
                      onChange={(e) => handleInputChange(e, row.id)}
                      placeholder="Enter item type"
                    />
                  </td>
                  <td>
                    <Form.Control
                      type="number"
                      name="quantity"
                      value={row.quantity}
                      onChange={(e) => handleInputChange(e, row.id)}
                      placeholder="Enter quantity"
                    />
                  </td>
                  <td>
                    <Form.Control
                      type="number"
                      name="unitPrice"
                      value={row.unitPrice}
                      onChange={(e) => handleInputChange(e, row.id)}
                      placeholder="Enter unit price"
                    />
                  </td>
                  <td>USD {row.subtotal}</td>
                  <td>
                    <Form.Control
                      type="text"
                      name="notes"
                      value={row.notes}
                      onChange={(e) => handleInputChange(e, row.id)}
                      placeholder="Enter notes"
                    />
                  </td>
                  <td>
                    <Button
                      variant="success"
                      onClick={() => handleSaveRow(row.id)}
                    >
                      <IoIosSave />
                    </Button>{' '}
                    <Button
                      variant="danger"
                      onClick={() => handleDeleteRow(row.id)}
                    >
                      <RiDeleteBin5Line />
                    </Button>
                  </td>
                </>
              ) : (
                <>
                  <td>{row.name}</td>
                  <td>{row.itemType}</td>
                  <td>{row.quantity}</td>
                  <td>USD {row.unitPrice}</td>
                  <td>USD {row.subtotal}</td>
                  <td>{row.notes}</td>
                  <td>
                    <Button
                      variant="primary"
                      onClick={() => setEditRowId(row.id)}
                    >
                      <FiEdit3 />
                    </Button>{' '}
                    <Button
                      variant="danger"
                      onClick={() => handleDeleteRow(row.id)}
                    >
                      <RiDeleteBin5Line />
                    </Button>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
};

export default PackageTable;
