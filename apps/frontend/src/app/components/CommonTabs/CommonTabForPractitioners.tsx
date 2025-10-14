"use client";
import React, { useState } from "react";
import { Tabs, Tab, Dropdown } from "react-bootstrap";
import PracticeteamtableForBusinessDashboard from "@/app/components/DataTable/PracticeteamtableForBusinessDashboard";

import "./CommonTabs.css";

interface TabData {
  eventKey?: string;
  title?: string;
}

interface CommonTabsProps {
  tabs: TabData[];
  defaultActiveKey?: string;
  showStatusSelect?: boolean;
  headname?: string;
}

const roleOptions = [
  { key: "all", value: "All" },
  { key: "vet", value: "Vet" },
  { key: "nurse", value: "Nurse" },
  { key: "receptionist", value: "Receptionist" },
  { key: "vetTechnician", value: "Vet Technician" },
  { key: "vetAssistant", value: "Vet Assistant" },
];

const CommonTabForPractitioners = ({
  tabs,
  defaultActiveKey,
  showStatusSelect = false,
  headname,
}: CommonTabsProps) => {
  const [role, setRole] = useState<string>("all");
  const [activeKey, setActiveKey] = useState<string | undefined>(
    defaultActiveKey || tabs[0]?.eventKey
  );

  const handleDropdownSelect = (eventKey: string | null) => {
    if (eventKey) {
      setRole(eventKey);
    }
  };

  const handleTabSelect = (eventKey: string | null) => {
    if (eventKey) {
      setActiveKey(eventKey);
    }
  };

  return (
    <div className="LinesTabsSec">
      {showStatusSelect && headname !== "Inventory" && (
        <div className="SelectStatus">
          <p>Role:</p>
          <Dropdown onSelect={handleDropdownSelect}>
            <Dropdown.Toggle
              className="custom-status-dropdown"
              id="dropdown-status"
            >
              {roleOptions.find((opt) => opt.key === role)?.value}
            </Dropdown.Toggle>
            <Dropdown.Menu>
              {roleOptions.map((opt) => (
                <Dropdown.Item
                  eventKey={opt.key}
                  key={opt.key}
                  active={role === opt.key}
                >
                  {opt.value}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
        </div>
      )}
      <Tabs
        defaultActiveKey={activeKey}
        className="linesTabs"
        onSelect={handleTabSelect}
      >
        {tabs.map((tab) => (
          <Tab eventKey={tab.eventKey} title={tab.title} key={tab.eventKey}>
            {activeKey === tab.eventKey && tab.eventKey && (
              <PracticeteamtableForBusinessDashboard
                departmentId={tab.eventKey}
                role={role}
              />
            )}
          </Tab>
        ))}
      </Tabs>
    </div>
  );
};

export default CommonTabForPractitioners;
