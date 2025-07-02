"use client";
import React, { useState } from "react";
import { Tabs, Tab, Dropdown } from 'react-bootstrap';
import "./CommonTabs.css";

interface TabData {
  eventKey: string;
  title: string;
  content: React.ReactNode;
  count?: number; // optional
}

interface CommonTabsProps {
  tabs: TabData[];
  defaultActiveKey?: string;
  showStatusSelect?: boolean; // 👈 optional
}

const statusOptions = ['Confirmed', 'Pending', 'Cancelled'];

const CommonTabs = ({ tabs, defaultActiveKey, showStatusSelect = false }: CommonTabsProps) => {
  const [status, setStatus] = useState<string>('Confirmed');

  const handleDropdownSelect = (eventKey: string | null) => {
    if (eventKey) setStatus(eventKey);
  };

  return (
    <div className="LinesTabsSec">
      <Tabs defaultActiveKey={defaultActiveKey || tabs[0].eventKey} className="linesTabs ">
        {tabs.map((tab) => (
          <Tab eventKey={tab.eventKey} title={<>{tab.title} {tab.count && (<span className="tab-count-badge">{tab.count}</span>)}</>} key={tab.eventKey}>
            {tab.content}
          </Tab>
        ))}
      </Tabs>

      {showStatusSelect && (
        <div className="SelectStatus">
          <p>Status:</p>
          <Dropdown onSelect={handleDropdownSelect}>
            <Dropdown.Toggle className="custom-status-dropdown" id="dropdown-status">
              {status}
            </Dropdown.Toggle>
            <Dropdown.Menu>
              {statusOptions.map((opt) => (
                <Dropdown.Item eventKey={opt} key={opt} active={status === opt}>
                  {opt}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
        </div>
      )}
    </div>
  );
};

export default CommonTabs;
