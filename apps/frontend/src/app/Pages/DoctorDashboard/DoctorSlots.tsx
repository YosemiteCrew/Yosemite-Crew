"use client";
import React, { useEffect, useState, useCallback } from "react";
import { Button, Dropdown, Form } from "react-bootstrap";
import { FaCircleCheck } from "react-icons/fa6";
import "./DoctorDashboard.css";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { useOldAuthStore } from "@/app/stores/oldAuthStore";
import { Icon } from "@iconify/react/dist/iconify.js";
import { getData, postData } from "@/app/axios-services/services";
import { convertFromFhirSlotBundle, convertToFhirSlotResource } from "@yosemite-crew/fhir";
import Swal from "sweetalert2";
import { format, addDays } from "date-fns";

// ➤ Get upcoming valid range to display (e.g. 25th – 21st Aug 2025)
export function getUpcomingDayRangeFromToday(availableDays: string[], maxDates: number = 5): string | null {
  const today = new Date();
  const futureDates: Date[] = [];

  let i = 0;
  while (futureDates.length < maxDates && i < 60) {
    const d = addDays(today, i);
    const dayName = d.toLocaleDateString("en-US", { weekday: "long" });
    if (availableDays.includes(dayName)) {
      futureDates.push(d);
    }
    i++;
  }

  if (futureDates.length === 0) return null;

  const first = futureDates[0];
  const last = futureDates[futureDates.length - 1];

  return `${format(first, "do")} – ${format(last, "do MMM yyyy")}`;
}

function DoctorSlots() {
  const { userId, vetAndTeamsProfile } = useOldAuthStore();
  const days = vetAndTeamsProfile?.OperatingHour.map(d => d.day) ?? [];
  const range = getUpcomingDayRangeFromToday(days, days.length);

  const [date, setDate] = useState<Date>(new Date());
  const [day, setDay] = useState<string>(date.toLocaleDateString("en-US", { weekday: "long" }));
  const [duration, setDuration] = useState<number>(30);
  const [available, setAvailable] = useState(true);
  const [slots, setSlots] = useState<{ time: string; selected: boolean }[]>([]);
  const [unavailableSlots, setUnavailableSlots] = useState<string[]>([]);
  const [selectUnavailable, setSelectUnavailable] = useState(false);

  const formatTime = (date: Date) => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const isPM = hours >= 12;
    const formattedHours = isPM ? hours % 12 || 12 : hours || 12;
    const formattedMinutes = minutes.toString().padStart(2, "0");
    const period = isPM ? "PM" : "AM";
    return `${formattedHours}:${formattedMinutes} ${period}`;
  };

  const parseTime = (timeString: string) => {
    const [time, modifier] = timeString.split(" ");
    // eslint-disable-next-line prefer-const
    let [hours, minutes] = time.split(":").map(Number);
    if (modifier === "PM" && hours !== 12) hours += 12;
    if (modifier === "AM" && hours === 12) hours = 0;
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  const generateSlots = useCallback((mins?: number) => {
    const finalDuration = mins ?? duration;
    if (!vetAndTeamsProfile?.OperatingHour) {
      setSlots([]);
      setUnavailableSlots([]);
      return;
    }
    const dayAvailability = vetAndTeamsProfile.OperatingHour.find((v: any) => v.day === day);
    if (!dayAvailability || !dayAvailability.times || dayAvailability.times.length === 0) {
      setSlots([]);
      setUnavailableSlots([]);
      return;
    }

    const slotList: { time: string; selected: boolean }[] = [];
    dayAvailability.times.forEach((interval: any) => {
      const from = `${interval.from.hour}:${interval.from.minute} ${interval.from.period}`;
      const to = `${interval.to.hour}:${interval.to.minute} ${interval.to.period}`;
      let current = parseTime(from);
      const end = parseTime(to);
      while (current < end) {
        const nextSlot = new Date(current.getTime() + finalDuration * 60 * 1000);
        if (nextSlot > end) break;
        slotList.push({ time: formatTime(current), selected: false });
        current = nextSlot;
      }
    });
    setSlots(slotList);
    setUnavailableSlots([]);
  }, [duration, vetAndTeamsProfile, day]);

  const handleDropdownSelect = (eventKey: string | null) => {
    const mins = parseInt(eventKey || "30", 10);
    setDuration(mins);
    generateSlots(mins);
  };

  const handleSubmit = async () => {
    if (!userId || !day || !date) return;
    function formatDateLocal(date: Date): string {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const dayStr = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${dayStr}`;
    }

    const payload = {
      doctorId: userId,
      day,
      duration,
      date: formatDateLocal(date),
      timeSlots: slots,
      unavailableSlots: unavailableSlots ?? [],
    };

    try {
      const data = convertToFhirSlotResource(payload as any);
      const response = await postData("/fhir/v1/addDoctorsSlots", data);
      if (response.status === 200) {
        Swal.fire({
          icon: "success",
          title: "Slots Updated!",
          text: "The slots have been updated successfully.",
          timer: 2000,
          showConfirmButton: false,
        });
      }
    } catch (error) {
      console.error("Error updating slots:", error);
    }
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      function formatDateLocal(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const dayStr = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${dayStr}`;
      }
      if (!userId) return;

      try {
        const response = await getData("/fhir/v1/doctorslottocompare", {
          doctorId: userId,
          date: formatDateLocal(date),
          day,
        }) as { status: number; data?: { data?: any } };
        if (response.status === 200 && response.data?.data) {
          const { timeSlots, unavailableSlots, duration: apiDuration } = convertFromFhirSlotBundle(response.data.data) as {
            timeSlots: any[],
            unavailableSlots: string[],
            duration: string
          };

          if (Array.isArray(timeSlots) && timeSlots.length > 0) {
            setSlots(timeSlots.map((slot: any) => ({
              time: slot.time,
              selected: slot.selected,
            })));
          } else {
            generateSlots(duration);
          }

          setUnavailableSlots(unavailableSlots || []);
          setDuration(parseInt(apiDuration, 10) || 30);
        } else {
          generateSlots(duration);
        }
      } catch (error) {
        generateSlots(duration);
      }
    };
    fetchInitialData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, date, day]);

  return (
    <div className="DoctorAvailabilty">
      <h2>Appointment Slot Availability</h2>
      <div className="AvailabityDivDoctor">
        <div className="AvltyFor">
          <div className="avldate">
            <h5>Availability for</h5>
            <div className="jhjh">
              <span>{range}</span>
              <Icon icon="solar:calendar-mark-bold" width="24" height="24" />
            </div>
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
                {`${duration} mins`}
              </Dropdown.Toggle>
              <Dropdown.Menu>
                {["15", "30", "45", "60"].map((opt) => (
                  <Dropdown.Item key={opt} eventKey={opt} active={duration === parseInt(opt)}>
                    {`${opt} mins`}
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown>
          </div>
        </div>

        <div className="AvailDateSlotDiv">
          <div className="left-calendar">
            <div className="SlotInfo">
              <h6>Select Date</h6>
            </div>
            <div className="SlotClender">
              <Calendar
                selectRange={false}
                onChange={(value) => {
                  if (value instanceof Date) {
                    setDate(value);
                    const selectedDay = value.toLocaleDateString("en-US", { weekday: "long" });
                    setDay(selectedDay);
                  }
                }}
                minDate={new Date()}
                value={date}
                minDetail="month"
                maxDetail="month"
                showNeighboringMonth={false}
                tileDisabled={({ date: tileDate }) => {
                  const tileDay = tileDate.toLocaleDateString("en-US", { weekday: "long" });
                  return !days.includes(tileDay);
                }}
                tileClassName={({ date: calDate }) =>
                  calDate.toDateString() === date.toDateString() ? "selected-range" : ""
                }
              />
            </div>
          </div>

          <div className="right-slots">
            <div className="SlotInfo">
              <div>Select Slots</div>
              <Form.Check
                type="checkbox"
                label="Select Unavailable"
                checked={selectUnavailable}
                onChange={() => setSelectUnavailable((prev) => !prev)}
              />
            </div>

            <div className="slot-grid">
              {slots?.map(({ time }, idx) => {
                const isUnavailable = unavailableSlots.includes(time);
                return (
                  <Button
                    key={idx}
                    className={`slot-btn ${isUnavailable ? "unavailable" : ""}`}
                    disabled={isUnavailable || !selectUnavailable}
                    onClick={() => {
                      if (!selectUnavailable || isUnavailable) return;
                      setUnavailableSlots((prev) => [...prev, time]);
                    }}
                  >
                    {time}
                  </Button>
                );
              })}
            </div>

            <div className="slot-grid slot-gridd">
              {unavailableSlots?.map((time, idx) => (
                <div key={idx}>
                  <div className="kk">
                    <Button className="slot-btn unavailable" disabled={true}>
                      {time}
                    </Button>
                    <p>Unavailable Slot</p>
                  </div>
                  {selectUnavailable && (
                    <Icon
                      icon="lsicon:minus-filled"
                      width="16"
                      height="16"
                      onClick={() =>
                        setUnavailableSlots((prev) =>
                          prev.filter((t) => t !== time)
                        )
                      }
                      style={{ cursor: "pointer", color: "#ff5555" }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <Button onClick={handleSubmit} className="updateBtn">
          Update <FaCircleCheck size={20} />
        </Button>
      </div>
    </div>
  );
}

export default DoctorSlots;
