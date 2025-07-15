"use client";
import React, { useState } from "react";
import { Tabs, Tab, Dropdown } from "react-bootstrap";
import "./CommonTabs.css";

interface TabData {
  eventKey: string;
  title: string;
  content: React.ReactNode;
  count?: number; // optional
}

interface CommonTabsProps {
  tabs: TabData[];
  onTabClick?: (eventKey: string) => void;
  defaultActiveKey?: string;
  showStatusSelect?: boolean;
  headname?:string // 👈 optional
}

const statusOptions = ["Confirmed", "Pending", "Cancelled"];

const CommonTabs = ({
  tabs,
  onTabClick,
  defaultActiveKey,
  showStatusSelect = false,
  headname
}: CommonTabsProps) => {
  const [status, setStatus] = useState<string>("Confirmed");

  const handleDropdownSelect = (eventKey: string | null) => {
    if (eventKey) setStatus(eventKey);
  };

  console.log(tabs,"tabs")

  return (
    <>
      <div className="LinesTabsSec">
        <Tabs
          // defaultActiveKey={defaultActiveKey || tabs[0].title}
          className="linesTabs "
          onSelect={(eventKey) => {
            if (eventKey) onTabClick(eventKey);
          }}
        >
          {tabs.map((tab) => (
            <Tab
              eventKey={tab.eventKey}
              title={
                <>
                  {tab.title}{" "}
                  {tab.count && (
                    <span className="tab-count-badge">{tab.count}</span>
                  )}
                </>
              }
              key={tab.title}
              // onClick={() => onTabClick(tab.title)}
            >
              {tab.content}
            </Tab>
          ))}
        </Tabs>
        {showStatusSelect && headname !=="Inventory" &&(
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
                    eventKey={opt}
                    key={opt}
                    active={status === opt}
                  >
                    {opt}
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown>
          </div>
        )}
      </div>
    </>
  );
};

export default CommonTabs;
