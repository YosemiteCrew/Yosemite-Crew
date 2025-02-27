import React, { useState, useEffect, useCallback } from 'react';
import { Table, Button, Form } from 'react-bootstrap';
import { FiEdit3 } from 'react-icons/fi';
import { RiDeleteBin5Line } from 'react-icons/ri';
import { IoIosSave } from 'react-icons/io';
import { debounce } from 'lodash';
import axios from 'axios';
import { useAuth } from '../../context/useAuth';
import Swal from 'sweetalert2';

const ViewPackageTable = ({ updatePackageItems, packageItems,fetchPackageDataa }) => {
    const {userId} = useAuth();
  const [rows, setRows] = useState(packageItems || []);
  const [editRowId, setEditRowId] = useState(null);
  const [editedRow, setEditedRow] = useState(null);
console.log('rows', rows);
  // Debounced update function
  const debouncedUpdate = useCallback(
    debounce((updatedRows) => updatePackageItems(updatedRows), 300),
    []
  );

  useEffect(() => {
    setRows(packageItems); // Ensure rows update when packageItems change
  }, [packageItems]);

  useEffect(() => {
    debouncedUpdate(rows);
  }, [rows, debouncedUpdate]);

  const handleInputChange = useCallback((e, id) => {
    const { name, value } = e.target;
    setEditedRow((prev) => ({
      ...prev,
      [name]: name === 'quantity' || name === 'unitPrice' ? Number(value) : value,
      subtotal:
        name === 'quantity' || name === 'unitPrice'
          ? name === 'quantity'
            ? Number(value) * prev.unitPrice
            : prev.quantity * Number(value)
          : prev.subtotal,
    }));
  }, []);

  const handleEditRow = useCallback((row) => {
    setEditRowId(row._id);
    setEditedRow(row);
  }, []);

  const handleSaveRow = useCallback(() => {
    setRows((prevRows) =>
      prevRows.map((row) => (row._id === editRowId ? editedRow : row))
    );
    setEditRowId(null);
    updatePackageItems(rows);
  }, [editRowId, editedRow, rows, updatePackageItems]);

  const handleDeleteRow = useCallback((id) => {
    Swal.fire({
      title: 'Are you sure?',
      text: 'You will not be able to recover this item!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, delete it!',
    }).then((result) => {
      if (result.isConfirmed) {
        setRows((prevRows) => prevRows.filter((row) => row._id !== id));
        deleteItems(id); // Call API after confirming
      }
    });
  }, []);
  
  const deleteItems = async (id) => {
    try {
      await axios.delete(`${process.env.NX_PUBLIC_VITE_BASE_URL}api/inventory/deleteProcedureitems?id=${id}&userId=${userId}`);
      Swal.fire({
        title: 'Deleted!',
        text: 'Item has been deleted successfully.',
        icon: 'success',
      });
    } catch (error) {
      console.error('Error deleting item:', error);
      Swal.fire({
        title: 'Error',
        text: 'Failed to delete the item.',
        icon: 'error',
      });
    }
  };
  
  
  return (
    <div className="PackageTableDiv">
      <div className="PackageHead">
        <h3>
          Package Items <span>({rows.length})</span>
        </h3>
      </div>
      <Table className="Packgetable">
        <thead>
          <tr>
            <th>Name</th>
            <th>Item Type</th>
            <th>Quantity</th>
            <th>Unit Price</th>
            <th>Subtotal</th>
            <th>Notes</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row._id}>
              {editRowId === row._id ? (
                <>
                  <td>
                    <Form.Control
                      type="text"
                      name="name"
                      value={editedRow.name}
                      onChange={(e) => handleInputChange(e, row._id)}
                      placeholder="Enter name"
                    />
                  </td>
                  <td>
                    <Form.Control
                      type="text"
                      name="itemType"
                      value={editedRow.itemType}
                      onChange={(e) => handleInputChange(e, row._id)}
                      placeholder="Enter item type"
                    />
                  </td>
                  <td>
                    <Form.Control
                      type="number"
                      name="quantity"
                      value={editedRow.quantity}
                      onChange={(e) => handleInputChange(e, row._id)}
                      placeholder="Enter quantity"
                    />
                  </td>
                  <td>
                    <Form.Control
                      type="number"
                      name="unitPrice"
                      value={editedRow.unitPrice}
                      onChange={(e) => handleInputChange(e, row._id)}
                      placeholder="Enter unit price"
                    />
                  </td>
                  <td>USD {editedRow.subtotal}</td>
                  <td>
                    <Form.Control
                      type="text"
                      name="notes"
                      value={editedRow.notes}
                      onChange={(e) => handleInputChange(e, row._id)}
                      placeholder="Enter notes"
                    />
                  </td>
                  <td>
                    <Button variant="success" onClick={handleSaveRow}>
                      <IoIosSave />
                    </Button>{' '}
                    <Button variant="danger" onClick={() => handleDeleteRow(row._id)}>
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
                    <Button variant="primary" onClick={() => handleEditRow(row)}>
                      <FiEdit3 />
                    </Button>{' '}
                    <Button variant="danger" onClick={() => handleDeleteRow(row._id)}>
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

export default ViewPackageTable;
