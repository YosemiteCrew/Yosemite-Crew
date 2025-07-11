import React from "react";
import "./CalendarCard.css";
import Image from "next/image";
import { FaCalendar, FaCircleCheck, FaUser } from "react-icons/fa6";
import { AiFillMinusCircle } from "react-icons/ai";
import { Button } from "react-bootstrap";

const calendarData = [
  {
    name: "Luna",
    doctor: "John Smith",
    avatar: "/Images/eyes.png",
    status: "Confirmed",
    date: "Tuesday, 20 Aug–11:30 AM",
  },
  {
    name: "Charlie",
    doctor: "David Lee",
    avatar: "/Images/eyes.png",
    status: "Confirmed",
    date: "Tuesday, 20 Aug–11:30 AM",
  },
  {
    name: "Charlie",
    doctor: "David Lee",
    avatar: "/Images/eyes.png",
    status: "Upcoming",
    date: "Saturday, 24 Aug–11:30 AM",
  },
  {
    name: "Bella",
    doctor: "Sarah Johnson",
    avatar: "/Images/eyes.png",
    status: "Confirmed",
    date: "Appointment Completed",
  },
  {
    name: "Daisy",
    doctor: "Charlotte Davis",
    avatar: "/Images/eyes.png",
    status: "Confirmed",
    date: "Tuesday, 20 Aug–11:30 AM",
  },
  {
    name: "Daisy",
    doctor: "Charlotte Davis",
    avatar: "/Images/eyes.png",
    status: "Upcoming",
    date: "Saturday, 24 Aug–11:30 AM",
  },
  {
    name: "Bella",
    doctor: "Sarah Johnson",
    avatar: "/Images/eyes.png",
    status: "Completed",
    date: "Appointment Completed",
  },
  {
    name: "Daisy",
    doctor: "Charlotte Davis",
    avatar: "/Images/eyes.png",
    status: "Completed",
    date: "Appointment Completed",
  },
  {
    name: "Luna",
    doctor: "John Smith",
    avatar: "/Images/eyes.png",
    status: "Completed",
    date: "Appointment Completed",
  },
  {
    name: "Luna",
    doctor: "John Smith",
    avatar: "/Images/eyes.png",
    status: "Cancelled",
    date: "Appointment Cancelled",
  },
  {
    name: "Charlie",
    doctor: "David Lee",
    avatar: "/Images/eyes.png",
    status: "Cancelled",
    date: "Appointment Cancelled",
  },
  {
    name: "Daisy",
    doctor: "Charlotte Davis",
    avatar: "/Images/eyes.png",
    status: "Cancelled",
    date: "Appointment Cancelled",
  },
  {
    name: "Luna",
    doctor: "John Smith",
    avatar: "/Images/eyes.png",
    status: "Cancelled",
    date: "Appointment Cancelled",
  },
];

function CalendarCard() {
  return (
    <div className="Doct_Clender_Data">
      <div className="CalendarStatusColumns">
        {[
          {
            status: "Confirmed",
            count: 4,
            key: "confirmed",
            color: "#247AED",
          },
          {
            status: "Upcoming",
            count: 3,
            key: "upcoming",
            color: "#247AED",
          },
          {
            status: "Completed",
            count: 3,
            key: "completed",
            color: "#247AED",
          },
          {
            status: "Cancelled",
            count: 4,
            key: "cancelled",
            color: "#247AED",
          },
        ].map((col) => (
          <div key={col.key} className="ClnderCardItem">
            <div className="ClndercardText">
              <h6>{col.status}</h6>
              <span style={{ color: col.color }}>
                {col.count.toString().padStart(2, "0")}
              </span>
            </div>

            <div className="ClendrCard">
              {calendarData
                .filter((item) => item.status === col.status)
                .slice(0, 4) // ✅ Show only 4 cards per section
                .map((item, i) => (
                  <div key={i} className="CalendarCardItem">
                    <div className="ClndrUser">
                      <Image
                        aria-hidden
                        src={item.avatar}
                        alt={item.name}
                        width={60}
                        height={60}
                      />

                      <div className="ClndrUserText">
                        <h6>{item.name}</h6>
                        <p>
                          <span>
                            <FaUser />
                          </span>{" "}
                          {item.doctor}
                        </p>
                      </div>
                    </div>

                    <Button className="ClnderBtn">
                      {item.status === "Confirmed" ||
                      item.status === "Upcoming" ? (
                        <>
                          <span>
                            <FaCalendar />
                          </span>
                          {item.date}
                        </>
                      ) : null}
                      {item.status === "Completed" && (
                        <>
                          <span>
                            <FaCircleCheck />
                          </span>
                          Appointment Completed
                        </>
                      )}
                      {item.status === "Cancelled" && (
                        <>
                          <span>
                            <AiFillMinusCircle />
                          </span>
                          Appointment Cancelled
                        </>
                      )}
                    </Button>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CalendarCard;
