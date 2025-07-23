"use client";
import React, {  useState } from "react";
import { Button, Dropdown, Form } from 'react-bootstrap';
import { FaCircleCheck } from 'react-icons/fa6';
import "./DoctorDashboard.css";

import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

function DoctorSlots() {


    const [status, setStatus] = useState<string>("30 mins");
    const handleDropdownSelect = (eventKey: string | null) => {
        setStatus(eventKey as string);
    };
    const [available, setAvailable] = useState(true);



    

  // sdknsdkn


  const timeSlots = [
    "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM", "01:00 PM",
    "01:30 PM", "02:00 PM", "02:30 PM", "03:00 PM", "03:30 PM", "04:00 PM",
    "04:30 PM", "05:00 PM", "05:30 PM", "06:00 PM", "06:30 PM", "07:00 PM", "07:30 PM"
  ];


  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [selectedSlots, setSelectedSlots] = useState<{ [date: string]: string[] }>({});

  const [selectAll, setSelectAll] = useState(false);
  const [selectUnavailable, setSelectUnavailable] = useState(false);

  const toggleDate = (date: string) => {
    setSelectedDates((prev) =>
      prev.includes(date)
        ? prev.filter((d) => d !== date)
        : [...prev, date]
    );
  };

  const handleSlotToggle = (date: string, slot: string) => {
    setSelectedSlots((prev) => {
      const currentSlots = prev[date] || [];
      const isSelected = currentSlots.includes(slot);
      const updatedSlots = isSelected
        ? currentSlots.filter((s) => s !== slot)
        : [...currentSlots, slot];
      return { ...prev, [date]: updatedSlots };
    });
  };

  // const handleDropdownSelect = (value) => {
  //   setStatus(value);
  // };

  const handleSelectAll = () => {
    setSelectAll(!selectAll);
    const allDates = ["2025-12-27", "2025-12-28", "2025-12-29", "2025-12-30", "2025-12-31"];
    setSelectedDates(selectAll ? [] : allDates);
  };




  // Get all days of current visible month
  const getAllDatesOfMonth = (year: number, month: number) => {
    const dates: string[] = [];
    const date = new Date(year, month, 1);
    while (date.getMonth() === month) {
      dates.push(date.toISOString().slice(0, 10));
      date.setDate(date.getDate() + 1);
    }
    return dates;
  };

  

  const [currentDate, setCurrentDate] = useState(new Date());



  // sdknsdkn




  return (
    <>

    <div className="DoctorAvailabilty">
            <h2>Appointment Slot Availability</h2>
           
            <div className="AvailabityDivDoctor">

              <div className="AvltyFor">
                <div className="avldate">
                  <h5>Availability for</h5>
                  <Form.Control
                    className="AvlDatepicker"
                    type="date"
                    id="appointmentDate"
                    title="Choose your date"
                  />
                </div>
                <div className="Avlswitch">
                  <p>Availability Status</p>
                  <div className="custom-toggle-container">
                    <label className="custom-switch">
                      <input
                        type="checkbox"
                        checked={available}
                        onChange={() => setAvailable(!available)}
                      />
                      <span className="slider" />
                    </label>
                    <span className={`status-text ${available ? "available" : "not-available"}`}>
                      {available ? "Available" : "Not Available"}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="appointselect">
                <div className="lft">
                  <h6>Set Appointment Duration</h6>
                  <p>Set the default time for appointments.</p>
                </div>
                <div className="ryt">
                  <Dropdown onSelect={handleDropdownSelect}>
                    <Dropdown.Toggle className="custom-status-dropdown" id="dropdown-status">
                      {status}
                    </Dropdown.Toggle>
                    <Dropdown.Menu>
                      {["15 mins", "30 mins", "45 mins", "60 mins"].map((opt) => (
                        <Dropdown.Item key={opt} eventKey={opt} active={status === opt}>
                          {opt}
                        </Dropdown.Item>
                      ))}
                    </Dropdown.Menu>
                  </Dropdown>
                </div>
              </div>




              {/* Date & Slot Section */}
              <div className="AvailDateSlotDiv">

                {/* Left Column: Calendar & checkboxes */}
                <div className="left-calendar">
                  <div className="SlotInfo">
                    <h6>Select Date</h6>
                    <Form.Check
                      type="checkbox"
                      label="Select All"
                      checked={selectAll}
                      onChange={handleSelectAll}
                    />
                  </div>
                  <div className="SlotClender">
                    <Calendar
                      // Allow user to select up to 4 dates
                      onClickDay={(date) => {
                        const iso = date.toISOString().slice(0, 10);
                        setSelectedDates((prev) => {
                          if (prev.includes(iso)) {
                            return prev.filter((d) => d !== iso);
                          } else if (prev.length < 4) {
                            return [...prev, iso];
                          }
                          return prev;
                        });
                      }}
                      tileClassName={({ date, view }) => {
                        if (view === "month" && selectedDates.includes(date.toISOString().slice(0, 10))) {
                          return "calendar-date selected";
                        }
                        return "calendar-date";
                      }}
                      minDetail="month"
                      maxDetail="month"
                      showNeighboringMonth={false}
                      // Optionally, disable past dates
                      tileDisabled={({ date }) => {
                        const today = new Date();
                        today.setHours(0,0,0,0);
                        return date < today;
                      }}
                      formatShortWeekday={(locale, date) =>
                        date.toLocaleDateString(locale, { weekday: "short" }).charAt(0)
                      }
                    />
                  </div>

                    





                </div>

                {/* Right Column: Slot Select */}
                <div className="right-slots">
                  <div className="SlotInfo">
                    <h6>Select Slot</h6>
                    <Form.Check
                      type="checkbox"
                      label="Select Unavailable"
                      checked={selectUnavailable}
                      onChange={() => setSelectUnavailable(!selectUnavailable)}
                    />
                  </div>

                  <div className="slot-grid ">

                    {timeSlots.map((slot, idx) => {
                      const selectedDate = selectedDates[0]; // For simplicity, just one
                      const isSelected = selectedSlots[selectedDate]?.includes(slot);
                      const isUnavailable = ["10:00 AM", "10:30 AM"].includes(slot);

                      return (
                        <Button
                          key={idx}
                          className={`slot-btn ${isUnavailable ? "unavailable" : ""} ${isSelected ? "selected" : ""}`}
                          disabled={isUnavailable}
                          onClick={() => handleSlotToggle(selectedDate, slot)}>
                          {slot}
                        </Button>
                      );
                    })}
                  </div>


                </div>

              </div>




              




              

             

              <Button  className="updateBtn">
                Update <FaCircleCheck size={20} />
              </Button>


            </div>
           
              
           
          </div>
        
    </>
  )
}

export default DoctorSlots