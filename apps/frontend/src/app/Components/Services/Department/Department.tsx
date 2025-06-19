'use client';
import React, { useState } from 'react';
import "./Department.css";
import { FaChevronRight } from "react-icons/fa";

const initialDepartments = [
  { label: "Emergency", checked: true, doctors: 7 },
  { label: "Surgery", checked: true, doctors: 2 },
  { label: "TPLO", checked: false, doctors: 0 },
  { label: "Oncology", checked: false, doctors: 0 },
  { label: "Internal Medicine", checked: true, doctors: 5 },
  { label: "Cardiology", checked: false, doctors: 0 },
];

function Department() {
  const [departments, setDepartments] = useState(initialDepartments);
  const [showAll, setShowAll] = useState(false);

  const handleCheck = (idx: number) => {
    setDepartments(depts =>
      depts.map((d, i) =>
        i === idx ? { ...d, checked: !d.checked } : d
      )
    );
  };

  const visibleDepartments = showAll ? departments : departments.slice(0, 5);

  return (
    <div className="department-card">
      <div className="department-header">
        <span className="department-title">Departments</span>
        {departments.length > 5 && (
          <button
            className="department-showall"
            type="button"
            onClick={() => setShowAll(v => !v)}
          >
            {showAll ? "Show Less" : "Show All"}
          </button>
        )}
      </div>
      <div className="department-list">
        {visibleDepartments.map((dept, idx) => (
          <label className="department-row" key={dept.label}>
            <input
              type="checkbox"
              className="form-check-input"
              checked={dept.checked}
              onChange={() => handleCheck(showAll ? idx : idx)}
            />
            <span className={`department-label${dept.checked ? " checked" : ""}`}>
              {dept.label}
            </span>
            {dept.doctors > 0 && (
              <span className="department-doctors">
                {dept.doctors} Doctors <FaChevronRight />
              </span>
            )}
          </label>
        ))}
      </div>
    </div>
  );
}

export default Department;