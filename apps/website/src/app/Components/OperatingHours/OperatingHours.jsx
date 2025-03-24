
import React, { useState, useEffect } from "react";
import "./OperatingHours.css";
// import DynamicSelect from "../DynamicSelect/DynamicSelect";

const OperatingHours = ({ onSave }) => {
  const [hours, setHours] = useState([
    {
      day: "Monday",
      times: [
        {
          from: { hour: "8", minute: "30", period: "AM" },
          to: { hour: "11", minute: "00", period: "AM" },
        },
      ],
      checked: true,
    },
    {
      day: "Tuesday",
      times: [
        {
          from: { hour: "10", minute: "00", period: "AM" },
          to: { hour: "5", minute: "00", period: "PM" },
        },
      ],
      checked: true,
    },
    {
      day: "Wednesday",
      times: [
        {
          from: { hour: "10", minute: "00", period: "AM" },
          to: { hour: "5", minute: "30", period: "PM" },
        },
      ],
      checked: true,
    },
    {
      day: "Thursday",
      times: [
        {
          from: { hour: "10", minute: "00", period: "AM" },
          to: { hour: "5", minute: "30", period: "PM" },
        },
      ],
      checked: true,
    },
    {
      day: "Friday",
      times: [
        {
          from: { hour: "10", minute: "00", period: "AM" },
          to: { hour: "5", minute: "30", period: "PM" },
        },
      ],
      checked: true,
    },
  ]);

  // Effect to call onSave when hours data changes
  useEffect(() => {
    if (onSave) {
      onSave(hours);
    }
  }, [hours, onSave]); // Depend on 'hours', so it triggers on every update

  const handleCheckboxChange = (index) => {
    setHours((prev) =>
      prev.map((hour, i) =>
        i === index ? { ...hour, checked: !hour.checked } : hour
      )
    );
  };

  const handleAddTimeSlot = (index) => {
    setHours((prev) =>
      prev.map((hour, i) =>
        i === index
          ? {
              ...hour,
              times: [
                ...hour.times,
                {
                  from: { hour: "", minute: "", period: "AM" },
                  to: { hour: "", minute: "", period: "AM" },
                },
              ],
            }
          : hour
      )
    );
  };

  const handleRemoveTimeSlot = (dayIndex, timeIndex) => {
    setHours((prev) =>
      prev.map((hour, i) =>
        i === dayIndex
          ? { ...hour, times: hour.times.filter((_, idx) => idx !== timeIndex) }
          : hour
      )
    );
  };

  const handleTimeChange = (dayIndex, timeIndex, type, field, value) => {
    setHours((prev) =>
      prev.map((hour, i) =>
        i === dayIndex
          ? {
              ...hour,
              times: hour.times.map((time, idx) =>
                idx === timeIndex
                  ? { ...time, [type]: { ...time[type], [field]: value } }
                  : time
              ),
            }
          : hour
      )
    );
  };

  // const options = [
  //   { value: "15", label: "15 mins" },
  //   { value: "30", label: "30 mins" },
  //   { value: "60", label: "1 hour" },
  //   { value: "120", label: "2 hours" },
  // ];

  return (
    <div className="operating-hours">
      <div className="Hours_List">
        {/* Headers */}
        <div className="TopHoursTitle">
          <p>Days</p>
          <p>From</p>
          <p>To</p>
          <p></p>
        </div>
        {hours.map((hour, dayIndex) => (
          <div className="DaysRow" key={hour.day}>
            {/* Days */}
            <div className="day_checkbox">
              <input
                type="checkbox"
                className="form-check-input"
                checked={hour.checked}
                onChange={() => handleCheckboxChange(dayIndex)}
              />
              <label>{hour.day}</label>
            </div>

            {/* From Section */}
            <div className="from-section">
              {hour.times.map((time, timeIndex) => (
                <div key={timeIndex} className="time-slot">
                  <input
                    type="text"
                    value={time.from.hour}
                    placeholder="HH"
                    onChange={(e) =>
                      handleTimeChange(
                        dayIndex,
                        timeIndex,
                        "from",
                        "hour",
                        e.target.value
                      )
                    }
                  />
                  :
                  <input
                    type="text"
                    value={time.from.minute}
                    placeholder="MM"
                    onChange={(e) =>
                      handleTimeChange(
                        dayIndex,
                        timeIndex,
                        "from",
                        "minute",
                        e.target.value
                      )
                    }
                  />
                  <div className="TimeRadioGroup">
                    <label>
                      <input
                        type="radio"
                        name={`from-period-${dayIndex}-${timeIndex}`}
                        checked={time.from.period === "AM"}
                        onChange={() =>
                          handleTimeChange(
                            dayIndex,
                            timeIndex,
                            "from",
                            "period",
                            "AM"
                          )
                        }
                      />
                      AM
                    </label>
                    <label>
                      <input
                        type="radio"
                        name={`from-period-${dayIndex}-${timeIndex}`}
                        checked={time.from.period === "PM"}
                        onChange={() =>
                          handleTimeChange(
                            dayIndex,
                            timeIndex,
                            "from",
                            "period",
                            "PM"
                          )
                        }
                      />
                      PM
                    </label>
                  </div>
                </div>
              ))}
            </div>

            {/* To Section */}
            <div className="to-section">
              {hour.times.map((time, timeIndex) => (
                <div key={timeIndex} className="time-slot">
                  <input
                    type="text"
                    value={time.to.hour}
                    placeholder="HH"
                    onChange={(e) =>
                      handleTimeChange(
                        dayIndex,
                        timeIndex,
                        "to",
                        "hour",
                        e.target.value
                      )
                    }
                  />
                  :
                  <input
                    type="text"
                    value={time.to.minute}
                    placeholder="MM"
                    onChange={(e) =>
                      handleTimeChange(
                        dayIndex,
                        timeIndex,
                        "to",
                        "minute",
                        e.target.value
                      )
                    }
                  />
                  <div className="TimeRadioGroup">
                    <label>
                      <input
                        type="radio"
                        name={`to-period-${dayIndex}-${timeIndex}`}
                        checked={time.to.period === "AM"}
                        onChange={() =>
                          handleTimeChange(
                            dayIndex,
                            timeIndex,
                            "to",
                            "period",
                            "AM"
                          )
                        }
                      />
                      AM
                    </label>
                    <label>
                      <input
                        type="radio"
                        name={`to-period-${dayIndex}-${timeIndex}`}
                        checked={time.to.period === "PM"}
                        onChange={() =>
                          handleTimeChange(
                            dayIndex,
                            timeIndex,
                            "to",
                            "period",
                            "PM"
                          )
                        }
                      />
                      PM
                    </label>
                  </div>
                </div>
              ))}
            </div>

            {/* Actions Section */}
            <div className="actions-section">
              {hour.times.map((_, timeIndex) => (
                <div key={timeIndex} className="action-buttons">
                  {timeIndex === 0 ? (
                    <button
                      type="button"
                      className="add-btn"
                      onClick={() => handleAddTimeSlot(dayIndex)}
                    >
                      <i className="ri-add-circle-line"></i>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="remove-btn"
                      onClick={() => handleRemoveTimeSlot(dayIndex, timeIndex)}
                    >
                      <i className="ri-delete-bin-fill"></i>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OperatingHours;
