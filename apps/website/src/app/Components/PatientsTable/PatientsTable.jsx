import React from 'react';
import { Table, Button } from 'react-bootstrap';
import { FaEye, FaUser } from 'react-icons/fa';
import { BiSolidEditAlt } from 'react-icons/bi';
import './PatientsTable.css';

const PatientsTable = ({ appointments = [] }) => {
  const getStatus = (data) => {
    if (data === 2 || data === 3)
      return { status: 'Cancelled', statusColor: 'danger' };
    if (data === 4) return { status: 'Checked-In', statusColor: 'success' };
    return { status: 'Unknown', statusColor: 'secondary' }; // Default case
  };

  return (
    <div className="Patients_table">
      <Table responsive className="table_custom">
        <thead>
          <tr>
            <th>Appt #</th>
            <th>Name</th>
            <th>Appointment ID</th>
            <th>Time</th>
            <th>Pet Type</th>
            <th>Appointment Source</th>
            <th>Doctor</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {appointments?.map((appointment, i) => {
            const appointmentStatus = getStatus(appointment.isCanceled);
            return (
              <tr key={appointment._id}>
                <td>
                  <strong>{i + 1}</strong>
                </td>
                <td>
                  <strong>{appointment.petName}</strong> <br />
                  <small>
                    <FaUser /> ({appointment.ownerName})
                  </small>
                </td>
                <td>
                  <strong>{appointment.tokenNumber}</strong>
                </td>
                <td>
                  <strong>{appointment.appointmentTime}</strong>
                </td>
                <td>
                  <strong>{appointment.petType}</strong> <br />
                  <small>({appointment.breed})</small>
                </td>
                <td>
                  <strong>{appointment.appointmentSource}</strong>
                </td>
                <td>
                  <strong>{appointment.veterinarian}</strong>
                  <br />
                  <small>{appointment.department}</small>
                </td>
                <td>
                  <div className="statusdiv">
                    <span
                      className={`status-indicator bg-${appointmentStatus.statusColor}`}
                    ></span>
                    <p>{appointmentStatus.status}</p>
                  </div>
                </td>
                <td>
                  <Button size="sm" className="me-1 btn">
                    <FaEye />
                  </Button>
                  <Button size="sm" className="me-1 btn">
                    <BiSolidEditAlt />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
};

export default PatientsTable;
