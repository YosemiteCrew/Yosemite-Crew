"use client";
import React, { useState } from "react";
import { Tabs, Tab, Dropdown } from "react-bootstrap";

import "./CommonTabs.css";

interface TabData {
  eventKey?: string;
  title?: string;
  content?: React.ReactNode;
  count?: number;
}

interface CommonTabsProps {
  tabs: TabData[];
  onTabClick?: (eventKey?: string, status?: string) => void;
  defaultActiveKey?: string;
  showStatusSelect?: boolean;
  headname?: string;
}

const statusOptions = [
  { key: "accepted", value: "Confirmed" },
  { key: "pending", value: "Pending" },
  { key: "cancelled", value: "Cancelled" },
];

const CommonTabForBusinessDashboard = ({
  tabs,
  onTabClick,
  defaultActiveKey,
  showStatusSelect = false,
  headname,
}: CommonTabsProps) => {
  const [status, setStatus] = useState<string>("Confirmed");

  const handleDropdownSelect = (eventKey: string | null) => {
    if (eventKey) {
      const selectedOption = statusOptions.find((opt) => opt.key === eventKey);
      if (selectedOption) {
        setStatus(selectedOption.value); // Set display value (capitalized)
        if (onTabClick) onTabClick(tabs[0].eventKey, eventKey); // Send lowercase key to API with default tab
      }
    }
  };

  return (
    <div className="LinesTabsSec">
      <Tabs
        defaultActiveKey={defaultActiveKey || tabs[0]?.eventKey}
        className="linesTabs"
        onSelect={(eventKey) => {
          if (eventKey && onTabClick)
            onTabClick(eventKey, status.toLowerCase());
        }}
      >
        {tabs.map((tab) => (
          <Tab
            eventKey={tab.eventKey}
            title={<>{tab.title} </>}
            key={tab.eventKey}
          >
            {tab.content}
          </Tab>
        ))}
      </Tabs>
      {showStatusSelect && headname !== "Inventory" && (
        <div className="SelectStatus">
          <p>Status:</p>
          <Dropdown onSelect={handleDropdownSelect}>
            <Dropdown.Toggle
              className="custom-status-dropdown"
              id="dropdown-status"
            >
              {status}
            </Dropdown.Toggle>
            <Dropdown.Menu>
              {statusOptions.map((opt) => (
                <Dropdown.Item
                  eventKey={opt.key}
                  key={opt.key}
                  active={status === opt.value}
                >
                  {opt.value}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
        </div>
      )}
    </div>
  );
};

export default CommonTabForBusinessDashboard;
