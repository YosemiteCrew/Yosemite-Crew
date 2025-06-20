"use client";
import React, { useState } from "react";
import "./NotificationPage.css";
import {
  FaUserMd,
  FaBell,
  FaComments,
  FaBoxOpen,
  FaShareAlt,
} from "react-icons/fa";
import { Button, Container } from "react-bootstrap";
import Image from "next/image";

const typeOptions = [
  "All",
  "Alert",
  "Reminders",
  "Assessments",
  "Record uploaded",
  "Messages",
  "Appointment",
  "Client Check In Status",
  "Chat",
  "Vaccination",
  "Task Status",
];
const statusOptions = ["All", "Read", "Unread"];
const timeOptions = ["Today", "Last 48 Hours", "Last 7 days"];

// Map notification type to icon and color
const typeIconMap: Record<
  string,
  { icon: React.ReactNode; bg: string; color: string }
> = {
  Assessments: { icon: <FaShareAlt />, bg: "#EAF3FF", color: "#1976d2" },
  Appointment: { icon: <FaUserMd />, bg: "#F6F6F6", color: "#1976d2" },
  Chat: { icon: <FaComments />, bg: "#F6F6F6", color: "#1976d2" },
  Alert: { icon: <FaBell />, bg: "#FFF4E6", color: "#FFB800" },
  Inventory: { icon: <FaBoxOpen />, bg: "#F6F6F6", color: "#1976d2" },
  // ...add more as needed...
  Default: { icon: <FaBell />, bg: "#F6F6F6", color: "#1976d2" },
};

const notifications = [
  {
    type: "Assessments",
    icon: <FaUserMd />,
    avatar: "/Images/doc1.png",
    title: "Send Assessment",
    desc: "Dr. A R Williams has assigned Feline grimace scale to Patient id #12389056",
    time: "02 mins ago",
    action: { label: "Share Assessment", icon: <FaUserMd /> },
  },
  {
    type: "Appointment",
    avatar: "/Images/pet.jpg",
    title: "Appointment Booked",
    desc: "Kizie's parents has booked an Appointment for 24th May 2025",
    time: "08 mins ago",
    action: null,
  },
  {
    type: "Chat",
    icon: <FaComments />,
    avatar: "/Images/pet.jpg",
    title: "New Chat Request",
    desc: "Oscar's parents wants to connect on chat",
    time: "12 mins ago",
    action: { label: "Chat", icon: <FaComments /> },
  },
  {
    type: "Assessments",
    avatar: "/Images/pet.jpg",
    title: "Assistance Requested",
    desc: "Dr. A S Williams has assigned you for Pre assessment of Patient ID: DB3952R42",
    time: "12 mins ago",
    action: { label: "Share Assessment", icon: <FaUserMd /> },
  },
  {
    type: "Alert",
    icon: <FaBell />,
    avatar: "/Images/doc1.png",
    title: "Send Report",
    desc: "Send Assessment Report to Dr. William Smith",
    time: "25 mins ago",
    action: { label: "Send Report", icon: <FaBell /> },
  },
  {
    type: "Inventory",
    icon: <FaBoxOpen />,
    avatar: null,
    title: "Low Inventory",
    desc: "You are running low on the inventory of Diagnostic supplies",
    time: "1d ago",
    action: { label: "View Inventory", icon: <FaBoxOpen /> },
  },
];

function NotificationPage() {
  const [type, setType] = useState("All");
  const [status, setStatus] = useState("All");
  const [time, setTime] = useState("Today");

  // Filter logic (expand as needed)
  const filtered = notifications.filter(
    (n) => type === "All" || n.type === type
    // Add status/time filter logic if you have status/time in your data
  );

  return (
    <>
      <section className="NotificationSection">
        <Container>
          <div className="notification-page">
            <h2 className="notification-title">Notification</h2>
            <div className="notification-main">
              {/* Left Filter */}
              <div className="notification-filter">
                <div className="filter-group">
                  <div className="filter-label">Type</div>
                  <div className="filter-btns">
                    {typeOptions.map((opt) => (
                      <button
                        key={opt}
                        className={`filter-btn${type === opt ? " active" : ""}`}
                        onClick={() => setType(opt)}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="filter-group">
                  <div className="filter-label">Status</div>
                  <div className="filter-btns">
                    {statusOptions.map((opt) => (
                      <button
                        key={opt}
                        className={`filter-btn${status === opt ? " active" : ""}`}
                        onClick={() => setStatus(opt)}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="filter-group">
                  <div className="filter-label">Time</div>
                  <div className="filter-btns">
                    {timeOptions.map((opt) => (
                      <button
                        key={opt}
                        className={`filter-btn${time === opt ? " active" : ""}`}
                        onClick={() => setTime(opt)}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {/* Right Notification List */}
              <div className="notification-list-card">
                <div className="notification-list-title">Today</div>
                <div className="notification-list">
                  {filtered.map((n, i) => {
                    const iconData =
                      typeIconMap[n.type] || typeIconMap["Default"];
                    return (
                      <div className="notification-row" key={i}>
                        <div className="notification-avatar-col">
                          <span
                            className="notification-type-icon"
                            style={{
                              background: iconData.bg,
                              color: iconData.color,
                            }}
                          >
                            {iconData.icon}
                          </span>
                          {n.avatar && (
                            <Image
                              src={n.avatar}
                              alt="avatar"
                              width={44}
                              height={44}
                              className="notification-img"
                            />
                          )}
                        </div>
                        <div className="notification-content">
                          <div className="notification-row-title">
                            {n.title}
                          </div>
                          <div className="notification-row-desc">{n.desc}</div>
                          <div className="notification-row-time">{n.time}</div>
                        </div>
                        {n.action && (
                          <div className="notification-action">
                            <Button
                              variant="outline-light"
                              className="notification-action-btn"
                            >
                              <span className="notification-action-icon">
                                {n.action.icon}
                              </span>
                              {n.action.label}
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}

export default NotificationPage;
