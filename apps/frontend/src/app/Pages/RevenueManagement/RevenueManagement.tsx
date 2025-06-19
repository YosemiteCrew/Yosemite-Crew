"use client";
import React, { useState } from "react";
import { Container, Dropdown, Row } from "react-bootstrap";
import "./RevenueManagement.css";
import { FaArrowUp, FaArrowDown } from "react-icons/fa6";
import { IoArrowDownCircleSharp, IoArrowUpCircleSharp } from "react-icons/io5";

function RevenueManagement() {
  const [selectedRange, setSelectedRange] = useState("Last 30 Days"); // graphSelected

  const summaryData = [
    {
      label: "Total Income",
      value: "$44,130",
      percent: 12.78,
      isUp: true,
      sub: "vs. previous 30 days",
    },
    {
      label: "IPD Income",
      value: "$10,945",
      percent: 4.63,
      isUp: true,
      sub: "vs. previous 30 days",
    },
    {
      label: "OPD Income",
      value: "$12,338",
      percent: 2.34,
      isUp: false,
      sub: "vs. previous 30 days",
    },
    {
      label: "Laboratory Income",
      value: "$20,847",
      percent: 8.98,
      isUp: true,
      sub: "vs. previous 30 days",
    },
  ];

  return (
    <div className="RevenueManagementSec">
      <Container>
        <Row>
          <HeadingSelected
            title="Revenue Dashboard"
            options={["Last 3 Months", "Last 6 Months", "Last 1 Year"]}
            selectedOption={selectedRange}
            onSelect={setSelectedRange}
          />
        </Row>
        <div className="revenue-summary-row">
          {summaryData.map((item) => (
            <div className="revenue-summary-card" key={item.label}>
              <div className="revenue-summary-label">{item.label}</div>
              <div className="revenue-summary-value">{item.value}</div>
              <div className="revenue-summary-sub">
                <span
                  className={
                    "revenue-summary-percent " +
                    (item.isUp ? "percent-up" : "percent-down")
                  }
                >
                  {item.isUp ? <IoArrowUpCircleSharp /> : <IoArrowDownCircleSharp />}
                  {item.percent}%
                </span>
                <span className="revenue-summary-vs"> {item.sub}</span>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </div>
  );
}

export default RevenueManagement;

// HeadingSelectedProps
type HeadingSelectedProps = {
  title: string;
  options: string[];
  selectedOption: string;
  onSelect: (option: string) => void;
};
export const HeadingSelected: React.FC<HeadingSelectedProps> = ({
  title,
  options,
  selectedOption,
  onSelect,
}) => {
  return (
    <div className="HeadingSelectDiv mb-2">
      <h5>{title}</h5>
      <Dropdown className="DaysSelectDiv">
        <Dropdown.Toggle size="sm" variant="light">
          {selectedOption}
        </Dropdown.Toggle>
        <Dropdown.Menu>
          {options.map((option, index) => (
            <Dropdown.Item key={index} onClick={() => onSelect(option)}>
              {option}
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown>
    </div>
  );
};