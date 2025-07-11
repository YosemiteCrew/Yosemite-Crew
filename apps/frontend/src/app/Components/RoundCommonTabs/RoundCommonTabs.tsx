"use client";
import React, { useState } from "react";
import { Tabs, Tab, Form } from "react-bootstrap";
import "./RoundCommonTabs.css";

interface TabData {
  eventKey: string;
  title: string;
  content: React.ReactNode;
  count?: number; // optional badge
}
interface RoundCommonTabsProps {
  tabs: TabData[];
  defaultActiveKey?: string;
  showSearch?: boolean; // toggle search
  onSearchChange?: (value: string) => void; // parent handler
}
function RoundCommonTabs({
  tabs,
  defaultActiveKey,
  showSearch,
  onSearchChange,}: RoundCommonTabsProps) {
  const [searchValue, setSearchValue] = useState("");
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);
    if (onSearchChange) {
      onSearchChange(value);
    }
  };
  return (
    <div className="RoundTabsSec">

        <Tabs defaultActiveKey={defaultActiveKey || tabs[0].eventKey} className="RoundTabs">
          {tabs.map((tab) => (
            <Tab
              eventKey={tab.eventKey}
              title={
                <>
                  {tab.title}
                  {tab.count && (
                    <span className="tab-count-badge">{tab.count}</span>
                  )}
                </>
              }
              key={tab.eventKey}
            >
              {tab.content}
            </Tab>
          ))}
        </Tabs>
        {showSearch && (
            <div className="SearchBar">
                <Form.Control type="text" placeholder="Search Team Member" value={searchValue} onChange={handleSearchChange}/>
            </div>
        )}
    </div>
  );
}
export default RoundCommonTabs;
