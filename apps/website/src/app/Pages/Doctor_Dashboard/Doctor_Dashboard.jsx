/* eslint-disable react-refresh/only-export-components */
// eslint-disable-next-line no-unused-vars
import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import "./Doctor_Dashboard.css";
import { BoxDiv, DivHeading } from "../Dashboard/page";
import box1 from "../../../../public/Images/box1.png";
import box7 from "../../../../public/Images/box7.png";
import box8 from "../../../../public/Images/box8.png";
import doctprofile from "../../../../public/Images/doctprofile.png";
import reviw from "../../../../public/Images/reviw.png";
import review1 from "../../../../public/Images/review1.png";
import review2 from "../../../../public/Images/review2.png";
import review3 from "../../../../public/Images/review3.png";
import ActionsTable from "../../Components/ActionsTable/ActionsTable";
import Accpt from "../../../../public/Images/acpt.png";
import Decln from "../../../../public/Images/decline.png";
import StatusTable from "../../Components/StatusTable/StatusTable";
import { Link } from "react-router-dom";
import { Button, Modal } from "react-bootstrap";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { FaCheckCircle } from "react-icons/fa";
import { BsPatchCheck } from "react-icons/bs";
import { useAuth } from "../../context/AuthContext";

const Doctor_Dashboard = () => {
  const { doctorProfile } = useAuth();
  const [showMore, setShowMore] = useState(false);
  const [duration, setduration] = useState(null);
  const [date, setDate] = useState(new Date());
  const [timeSlots, setTimeSlots] = useState([]);
  const [availabilityTimes, setAvailbilityTimes] = useState(null);
  console.log("timeSlots", timeSlots);
  useEffect(() => {
    if (doctorProfile) {
      setduration(doctorProfile.timeDuration);
    }
  }, [doctorProfile]);

  const handleShowMore = () => {
    setShowMore(true);
  };

  const handleShowLess = () => {
    setShowMore(false);
  };

  // Toggle Button
  const [isAvailable, setIsAvailable] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const handleToggle = () => {
    setIsAvailable(!isAvailable);
    setShowModal(true);
  };

  const closeModal = () => setShowModal(false);

  const handleDateChange = (selectedDate) => {
    setDate(selectedDate);
    const day = new Date(selectedDate).toLocaleDateString("en-US", {
      weekday: "long",
    });

    if (doctorProfile) {
      const filteredAvailability = doctorProfile.availability
        .filter((v) => v.day === day)
        .flatMap((v) => v.times)
        .map((v) => ({
          from: `${v.from.hour}:${v.from.minute} ${v.from.period}`,
          to: `${v.to.hour}:${v.to.minute} ${v.to.period}`,
        }));
      genrateSlotes(filteredAvailability, duration);
    }
  };

  const genrateSlotes = (filteredAvailability, duration) => {
    const slots = [];

    filteredAvailability.forEach(({ from, to }) => {
      const fromDate = parseTime(from); // Parse the 'from' time into a Date object
      const toDate = parseTime(to); // Parse the 'to' time into a Date object

      let current = new Date(fromDate);

      // Generate slots while the current time is less than the 'to' time
      while (current < toDate) {
        const nextSlot = new Date(current.getTime() + duration * 60 * 1000); // Add duration in minutes

        // Break if the next slot exceeds the 'to' time
        if (nextSlot > toDate) break;

        slots.push({
          time: formatTime(current), // Format current time into 'HH:MM AM/PM'
          selected: false,
        });

        current = nextSlot; // Move to the next slot
      }
    });

    console.log("Generated Slots:", slots);
    setTimeSlots(slots); // Update state with generated slots
  };

  const parseTime = (timeString) => {
    const [time, modifier] = timeString.split(" ");
    let [hours, minutes] = time.split(":").map(Number);

    if (modifier === "PM" && hours !== 12) hours += 12;
    if (modifier === "AM" && hours === 12) hours = 0;

    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  const formatTime = (date) => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const isPM = hours >= 12;

    const formattedHours = isPM ? hours % 12 || 12 : hours || 12;
    const formattedMinutes = minutes.toString().padStart(2, "0");
    const period = isPM ? "PM" : "AM";

    return `${formattedHours}:${formattedMinutes} ${period}`;
  };

  const toggleSlot = (index) => {
    const updatedSlots = timeSlots.map((slot, i) =>
      i === index ? { ...slot, selected: !slot.selected } : slot
    );
    setTimeSlots(updatedSlots);
  };

  const selectAllSlots = () => {
    const allSelected = timeSlots.every((slot) => slot.selected);
    const updatedSlots = timeSlots.map((slot) => ({
      ...slot,
      selected: !allSelected,
    }));
    setTimeSlots(updatedSlots);
  };

  return (

      <section className="DoctorDashBoardSec">
        <div className="container">
          <div className="MainDash">
            <div className="DoctDashTop">
              <div className="TopDashSlot">
                <div className="ProfileDash">
                  <img src={doctprofile} alt="" />
                  <div className="doctnameText">
                    <span>Welcome, Dr. David Brown</span>
                    <h2>Your Dashboard</h2>
                  </div>
                </div>

                <div className="toggleAvavilty">
                  <h6>Availability Status</h6>
                  <div className="togalrt">
                    <div
                      className={`toggle-switch ${isAvailable ? "active" : ""}`}
                      onClick={handleToggle}
                    >
                      <div className="toggle-circle"></div>
                    </div>
                    <p
                      className="avlbl"
                      style={{ color: isAvailable ? "#8AC1B1" : "gray" }}
                    >
                      {isAvailable ? "Available" : ""}
                    </p>
                  </div>
                  <p className="mngevigible">Manage Availability</p>
                </div>

                <Modal
                  className="DoctToogleDiv"
                  show={showModal}
                  onHide={closeModal}
                  centered
                >
                  <Modal.Header>
                    <h3>Manage Availability</h3>
                    <div className="avltog">
                      <h6>Availability Status</h6>
                      <div
                        className={`toggle-switch ${
                          isAvailable ? "active" : ""
                        }`}
                        onClick={handleToggle}
                      >
                        <div className="toggle-circle"></div>
                      </div>
                      <p style={{ color: isAvailable ? "#8AC1B1" : "gray" }}>
                        {isAvailable ? "Available" : ""}
                      </p>
                    </div>
                  </Modal.Header>
                  <Modal.Body>
                    <div className="DoctAvailBody">
                      <h5>Select Date</h5>
                      <Calendar
                        onChange={handleDateChange}
                        value={date}
                        className="custom-calendar"
                      />
                    </div>
                    <div className="Slectmodal">
                      <div className="TopSlctDiv">
                        <div className="lftSlot">
                          <h5>Select your available slots</h5>
                          <p>
                            Click a slot to toggle your availability for
                            appointments.
                          </p>
                        </div>
                        <div className="RytSlot">
                          <Button onClick={selectAllSlots}>
                            {" "}
                            <FaCheckCircle />{" "}
                            {timeSlots.every((slot) => slot.selected)
                              ? "Deselect All"
                              : "Select All"}{" "}
                          </Button>
                        </div>
                      </div>

                      {timeSlots.length === 0 ? (
                        "No Slotes Available"
                      ) : (
                        <div className="time-slot-selector">
                          <div className="time-slots">
                            {timeSlots.map((slot, index) => (
                              <button
                                key={index}
                                className={`time-slot ${
                                  slot.selected ? "selected" : ""
                                }`}
                                onClick={() => toggleSlot(index)}
                              >
                                {slot.time}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </Modal.Body>
                  <Modal.Footer>
                    <div className="ModlslotBtn">
                      <Button onClick={closeModal}> Cancel </Button>
                      <Button className="active" onClick={closeModal}>
                        {" "}
                        <BsPatchCheck /> Save Changes{" "}
                      </Button>
                    </div>
                  </Modal.Footer>
                </Modal>
              </div>

              <div className="overviewitem">
                <BoxDiv
                  boximg={box1}
                  ovradcls="chillibg"
                  ovrtxt="Appointments"
                  spanText="(Last 7 days)"
                  boxcoltext="ciltext"
                  overnumb="12"
                />
                <BoxDiv
                  boximg={box7}
                  ovradcls="purple"
                  ovrtxt="Appointments"
                  spanText="(Last 7 days)"
                  boxcoltext="purpletext"
                  overnumb="04"
                />
                <BoxDiv
                  boximg={box8}
                  ovradcls=" cambrageblue"
                  ovrtxt="Reviews"
                  boxcoltext="greentext"
                  overnumb="24"
                />
              </div>
            </div>
            <div>
              <DivHeading TableHead="New Appointments" tablespan="(3)" />
              <ActionsTable actimg1={Accpt} actimg2={Decln} />
            </div>
            <div>
              <DivHeading TableHead="Upcoming Assessments" tablespan="(3)" />
              <StatusTable />
            </div>
            <div className="ReviewsDiv">
              <DashHeadtext htxt="Reviews " hspan="(24)" />
              <div className="ReviewPading">
                <div className="ReviewsData">
                  <ReviewCard
                    isNew="New"
                    Revimg={review1}
                    Revname="Sky B"
                    Revpetname="Kizie"
                    Revdate="25 August 2024"
                    rating="5.0"
                    Revpara1="We are very happy with the services so far. Dr. Brown has been extremely thorough and generous with his time and explaining everything to us. When one is dealing with serious health issues it makes a huge difference to understand what's going on and know that the health providers are doing their best. Thanks!"
                  />
                  <ReviewCard
                    isNew="New"
                    Revimg={review2}
                    Revname="Pika"
                    Revpetname="Oscar"
                    Revdate="30 August 2024"
                    rating="4.7"
                    Revpara1="Dr. Brown, the Gastroenterology Specialist was very thorough with Oscar. Zoey was pre diabetic so Doc changed her meds from Prednisolone to Budesonide. In 5 days, Oscar’s glucose numbers were lower and in normal range. We are staying with Dr. Brown as Oscar’s vet as I don’t feel any anxiety dealing with Oscar’s illness now."
                  />
                  <ReviewCard
                    Revimg={review3}
                    Revname="Henry C"
                    Revpetname="Kizie"
                    Revdate="15 August 2024"
                    rating="4.9"
                    Revpara1="SFAMC and Dr. Brown in particular are the very best veterinary professionals I have ever encountered. The clinic is open 24 hours a day in case of an emergency, and is clean and well staffed."
                    Revpara2="Dr Brown is a compassionate veterinarian with both my horse and myself, listens and responds to my questions, and her mere pre.."
                  />
                </div>
                {!showMore && (
                  <div className="show-more">
                    <Link to="#" onClick={handleShowMore}>
                      View More
                    </Link>
                  </div>
                )}
                {showMore && (
                  <div className="ReviewsData">
                    <ReviewCard
                      Revimg={review1}
                      Revname="Sky B"
                      Revpetname="Kizie"
                      Revdate="25 August 2024"
                      rating="5.0"
                      Revpara1="We are very happy with the services so far. Dr. Brown has been extremely thorough and generous with his time and explaining everything to us. When one is dealing with serious health issues it makes a huge difference to understand what's going on and know that the health providers are doing their best. Thanks!"
                    />
                    <ReviewCard
                      Revimg={review2}
                      Revname="Pika"
                      Revpetname="Oscar"
                      Revdate="30 August 2024"
                      rating="4.7"
                      Revpara1="Dr. Brown, the Gastroenterology Specialist was very thorough with Oscar. Zoey was pre diabetic so Doc changed her meds from Prednisolone to Budesonide. In 5 days, Oscar’s glucose numbers were lower and in normal range. We are staying with Dr. Brown as Oscar’s vet as I don’t feel any anxiety dealing with Oscar’s illness now."
                    />
                    <ReviewCard
                      Revimg={review3}
                      Revname="Henry C"
                      Revpetname="Kizie"
                      Revdate="15 August 2024"
                      rating="4.9"
                      Revpara1="SFAMC and Dr. Brown in particular are the very best veterinary professionals I have ever encountered. The clinic is open 24 hours a day in case of an emergency, and is clean and well staffed."
                      Revpara2="Dr Brown is a compassionate veterinarian with both my horse and myself, listens and responds to my questions, and her mere pre.."
                    />
                    <div className="show-more">
                      <Link to="#" onClick={handleShowLess}>
                        View less
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

  );
};

export default Doctor_Dashboard;

ReviewCard.propTypes = {
  isNew: PropTypes.string.isRequired,
  Revimg: PropTypes.string.isRequired,
  Revname: PropTypes.string.isRequired,
  Revpetname: PropTypes.string.isRequired,
  Revdate: PropTypes.string.isRequired,
  rating: PropTypes.string.isRequired,
  Revpara1: PropTypes.string.isRequired,
  Revpara2: PropTypes.string.isRequired,
};
function ReviewCard({
  Revimg,
  isNew,
  Revname,
  Revpetname,
  Revdate,
  rating,
  Revpara1,
  Revpara2,
}) {
  return (
    <div className="Reviewcard">
      <div className="Reviwtop">
        <img src={Revimg} alt="review" />
        <div className="rbtext">
          <h6>{Revname}</h6>
          <p>
            <img src={reviw} alt="reviw" /> {Revpetname}
          </p>
        </div>
      </div>
      <div className="Reviwmid">
        <h6>{Revdate}</h6>
        <span>
          <i className="ri-star-fill"></i> {rating}
        </span>
      </div>

      <div className="reviwEnd">
        <p>
          {Revpara1} {Revpara2 && <p>{Revpara2}</p>}{" "}
        </p>
      </div>

      {isNew && (
        <span className="new-badge">
          <i className="ri-flashlight-fill"></i> New
        </span>
      )}
    </div>
  );
}

// Heading Text
DashHeadtext.propTypes = {
  htxt: PropTypes.string.isRequired,
  hspan: PropTypes.string.isRequired,
};
export function DashHeadtext({ htxt, hspan }) {
  return (
    <div className="DashHeading">
      <h5>
        {htxt} {hspan && <span>{hspan}</span>}
      </h5>
    </div>
  );
}
