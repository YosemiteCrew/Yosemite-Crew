// eslint-disable-next-line no-unused-vars
import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { BoxDiv, DivHeading, ListSelect, TopHeading } from '../Dashboard/page';
import './Appointment.css';
import UplodeImage from '../../Components/UplodeImage/UplodeImage';
import AssesmentResponse from '../../Components/AssesmentResponse/AssesmentResponse';
import whtmsg from '../../../../public/Images/whtmsg.png';
import pet1 from '../../../../public/Images/pet1.png';
import whtcheck from '../../../../public/Images/whtcheck.png';
import report1 from '../../../../public/Images/report1.png';
import report2 from '../../../../public/Images/report2.png';
import box2 from '../../../../public/Images/box2.png';
import box4 from '../../../../public/Images/box4.png';
import box5 from '../../../../public/Images/box5.png';
import box6 from '../../../../public/Images/box6.png';
import btn1 from '../../../../public/Images/btn1.png';
import btn2 from '../../../../public/Images/btn2.png';
import btn3 from '../../../../public/Images/btn3.png';
import btn4 from '../../../../public/Images/btn4.png';
import ChatApp from '../../Components/ChatApp/ChatApp';
import ActionsTable from '../../Components/ActionsTable/ActionsTable';
import Accpt from '../../../../public/Images/acpt.png';
import Decln from '../../../../public/Images/decline.png';
import DocterWiseAppoint from '../../Components/DocterWiseAppoint/DocterWiseAppoint';
import axios from 'axios';
import Swal from 'sweetalert2';
// import { Button } from 'react-bootstrap';

const Appointment = () => {
  // dropdown
  const optionsList1 = [
    'Last 7 Days',
    'Last 10 Days',
    'Last 20 Days',
    'Last 21 Days',
  ];
  const [allAppointments, setAllAppointments] = useState([]);
  const [total, setTotal] = useState();
  const getAllAppointments = async (offset) => {
    console.log('ssssssss');
    try {
      const response = await axios.get(
        `${process.env.NX_PUBLIC_VITE_BASE_URL}api/hospitals/getAllAppointments?offset=${offset}`
      );
      if (response) {
        console.log('hospitalssss', response.data);
        setAllAppointments(response.data.Appointments);
        setTotal(response.data.totalAppointments);
      }
    } catch (error) {
      console.log('error', error);
    }
  };
  const AppointmentActions = async (id, status, offset) => {
    console.log('iddd', id, status, offset);
    try {
      const response = await axios.put(
        `${process.env.NX_PUBLIC_VITE_BASE_URL}api/doctors/AppointmentAcceptedAndCancel/${id}`,
        { status }
      );
      if (response.status == 200) {
        Swal.fire({
          title: 'Appointment Status Changed',
          text: 'Appointment Status Changed Successfully',
          icon: 'success',
        });
      }
      getAllAppointments(offset);
      // getlast7daysAppointMentsCount();
    } catch (error) {
      Swal.fire({
        title: 'Error',
        text: 'Failed to Change Appointment Status',
        icon: 'error',
      });
    }
  };
  const [AppointmentStatusAndCounts, setAppointmentStatusAndCounts] = useState(
    {}
  );

  const getAppUpcCompCanTotalCounts = async (selectedOption) => {
    const days = parseInt(selectedOption.match(/\d+/)[0], 10);
    console.log(`Selected Days: ${days}`);
    try {
      const response = await axios.get(
        `${process.env.NX_PUBLIC_VITE_BASE_URL}api/hospitals/getAppUpcCompCanTotalCountOnDayBasis`,
        {
          params: {
            LastDays: days,
          },
        }
      );
      if (response) {
        setAppointmentStatusAndCounts(response.data);
      }
    } catch (error) {
      Swal.fire({
        title: 'Error',
        text: 'Failed to Get Appointments Counts',
        icon: 'error',
      });
    }
  };

  useEffect(() => {
    getAllAppointments(0);
    getAppUpcCompCanTotalCounts('Last 7 Days');
  }, []);

  return (
    <section className="AppintmentSection">
      <div className="container">
        <div className="MainDash">
          <TopHeading
            heding="Appointment Management"
            notif="3 New Appointments"
          />

          <div className="overviewDiv">
            <div className="OverviewTop">
              <h5>Overview</h5>
              <ListSelect
                options={optionsList1}
                onChange={getAppUpcCompCanTotalCounts}
              />
            </div>
            <div className="overviewitem">
              <BoxDiv
                boximg={box4}
                ovradcls=" fawndark"
                ovrtxt="New Appointments"
                boxcoltext="frowntext"
                overnumb={AppointmentStatusAndCounts.newAppointments}
              />
              <BoxDiv
                boximg={box2}
                ovradcls=" purple"
                ovrtxt="Upcoming"
                boxcoltext="purpletext"
                overnumb={AppointmentStatusAndCounts.upcomingAppointments}
              />
              <BoxDiv
                boximg={box5}
                ovradcls=" cambrageblue"
                ovrtxt="Completed"
                boxcoltext="greentext"
                overnumb={AppointmentStatusAndCounts.completedAppointments}
              />
              <BoxDiv
                boximg={box6}
                ovradcls="chillibg"
                ovrtxt="Cancelled"
                boxcoltext="ciltext"
                overnumb={AppointmentStatusAndCounts.canceledAppointments}
              />
            </div>
          </div>

          <div>
            <DivHeading TableHead="New Appointments" tablespan={`(${total})`} />
            <ActionsTable
              onClick={getAllAppointments}
              appointments={allAppointments}
              onClicked={AppointmentActions}
              actimg1={Accpt}
              actimg2={Decln}
            />
          </div>

          <div className="DashCardData">
            <div className="DashCardDiv">
              <CardHead Cdtxt="Confirmed" Cdnumb="03" CdNClas="fawn" />
              <div className="DashCardItem fawnbg">
                <AppointCard
                  crdimg={pet1}
                  cdowner="Kizie"
                  crdtpe="Sky B"
                  btnimg={btn1}
                  btntext="Tuesday, 10 Sep - 11:00 AM"
                  crddoctor="Dr. Emily Johnson"
                  drjob="Cardiology"
                  CardbtnClass="btnfown"
                />
                <AppointCard
                  crdimg={pet1}
                  cdowner="Max"
                  crdtpe="David Martin"
                  btnimg={btn1}
                  btntext="Tuesday, 10 Sep - 11:00 AM"
                  crddoctor="Dr. Olivia Harris"
                  drjob="Neurology"
                  CardbtnClass="btnfown"
                />
                <AppointCard
                  crdimg={pet1}
                  cdowner="Molly"
                  crdtpe="Lucas Miller"
                  btnimg={btn1}
                  btntext="Tuesday, 10 Sep - 11:00 AM"
                  crddoctor="Dr. Grace Walker"
                  drjob="Dentistry"
                  CardbtnClass="btnfown"
                />
              </div>
            </div>

            <div className="DashCardDiv">
              <CardHead Cdtxt="Upcoming" Cdnumb="02" CdNClas="purpl" />
              <div className="DashCardItem purplebg">
                <AppointCard
                  crdimg={pet1}
                  cdowner="Bella"
                  crdtpe="Sarah Johnson"
                  btnimg={btn2}
                  btntext="Tuesday, 10 Sep - 11:00 AM"
                  crddoctor="Dr. Michael Lee"
                  drjob="Orthopedics"
                  CardbtnClass="btnPurple"
                />
                <AppointCard
                  crdimg={pet1}
                  cdowner="Max"
                  crdtpe="David Martin"
                  btnimg={btn2}
                  btntext="Tuesday, 10 Sep - 11:00 AM"
                  crddoctor="Dr. Olivia Harris"
                  drjob="Neurology"
                  CardbtnClass="btnPurple"
                />
              </div>
            </div>

            <div className="DashCardDiv">
              <CardHead Cdtxt="Completed" Cdnumb="02" CdNClas="ltgren" />
              <div className="DashCardItem greenbg">
                <AppointCard
                  crdimg={pet1}
                  cdowner="Bella"
                  crdtpe="Sarah Johnson"
                  btnimg={btn3}
                  btntext="Tuesday, 10 Sep - 11:00 AM"
                  crddoctor="Dr. Michael Lee"
                  drjob="Orthopedics"
                  CardbtnClass="btngreen"
                />
                <AppointCard
                  crdimg={pet1}
                  cdowner="Max"
                  crdtpe="David Martin"
                  btnimg={btn3}
                  btntext="Tuesday, 10 Sep - 11:00 AM"
                  crddoctor="Dr. Olivia Harris"
                  drjob="Neurology"
                  CardbtnClass="btngreen"
                />
                <AppointCard
                  crdimg={pet1}
                  cdowner="Max"
                  crdtpe="David Martin"
                  btnimg={btn3}
                  btntext="Tuesday, 10 Sep - 11:00 AM"
                  crddoctor="Dr. Olivia Harris"
                  drjob="Neurology"
                  CardbtnClass="btngreen"
                />
              </div>
            </div>

            <div className="DashCardDiv">
              <CardHead Cdtxt="Cancelled" Cdnumb="02" CdNClas="chill" />
              <div className="DashCardItem chillybg">
                <AppointCard
                  crdimg={pet1}
                  cdowner="Bella"
                  crdtpe="Sarah Johnson"
                  btnimg={btn4}
                  btntext="Tuesday, 10 Sep - 11:00 AM"
                  crddoctor="Dr. Michael Lee"
                  drjob="Orthopedics"
                  CardbtnClass="btnchilly"
                />
                <AppointCard
                  crdimg={pet1}
                  cdowner="Max"
                  crdtpe="David Martin"
                  btnimg={btn4}
                  btntext="Tuesday, 10 Sep - 11:00 AM"
                  crddoctor="Dr. Olivia Harris"
                  drjob="Neurology"
                  CardbtnClass="btnchilly"
                />
              </div>
            </div>

            <DashModal />
          </div>

          <div className="dd">
            <DocterWiseAppoint />
          </div>
        </div>
      </div>
    </section>
  );
};

export default Appointment;

TextSpan.propTypes = {
  Textname: PropTypes.string.isRequired,
  Textnspan: PropTypes.string.isRequired,
  showLast7Days: PropTypes.bool,
};
TextSpan.defaultProps = {
  showLast7Days: false, // Default to hidden
};

// Text Span
export function TextSpan({ Textname, Textnspan, showLast7Days }) {
  return (
    <div className="TextHeading">
      <h5>
        {Textname} {Textnspan && <span>{Textnspan}</span>}
      </h5>
      {showLast7Days && <p>Last 7 Days</p>}
    </div>
  );
}

export function DashModal() {
  return (
    <div className="DashCardModal">
      <div
        className="modal fade"
        id="DashModal"
        tabIndex="-1"
        aria-labelledby="DashModalLabel"
        aria-hidden="true"
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="LeftContent">
              <div className="TopContent">
                <div className="lfttop">
                  <img src={pet1} alt="" />
                  <div className="owndt">
                    <h5>Appointment for Kizie</h5>
                    <p>
                      <i className="ri-user-fill"></i> Sky B
                    </p>
                  </div>
                </div>
                <div className="ryttop">
                  <a href="#">
                    <i className="ri-star-fill"></i> New
                  </a>
                </div>
              </div>

              <div className="MidContent">
                <h4>Appointment Details</h4>
                <div className="lfttop">
                  <img src={pet1} alt="" />
                  <div className="owndt">
                    <h6>Dr. Emily Johnson</h6>
                    <p>Cardiology</p>
                  </div>
                </div>

                <div className="cardbtn btnfown">
                  <button type="button">
                    <img src={btn1} alt="" /> Tuesday, 10 Sep - 11:00 AM
                  </button>
                </div>

                <div className="modlbtn">
                  <button type="button" className="confirm">
                    {' '}
                    <img src={box5} alt="" /> Confirm{' '}
                  </button>
                  <button type="button" className="cancel">
                    {' '}
                    <img src={box6} alt="" /> Cancel{' '}
                  </button>
                </div>
              </div>

              <div className="ModlMedclRept">
                <TextSpan Textname="Medical Reports " Textnspan="(2)" />
                <div className="MedReport">
                  <img src={report1} alt="" />
                  <img src={report2} alt="" />
                </div>
              </div>

              <AssesmentResponse />

              <div className="AssmtReportDiv">
                <TextSpan Textname="Assessment Report" />

                <div className="AssesmtSore">
                  <h6 className="emltext">Assessment Score</h6>
                  <div className="aa">
                    <ol className="score">
                      <div className="scrDiv">
                        <div className="scroli">
                          <li>
                            <input
                              type="radio"
                              name="recommend"
                              className="radio-button"
                              // arial-label="rate 1"
                              data-text="1"
                            />
                          </li>
                          <li>
                            <input
                              type="radio"
                              name="recommend"
                              className="radio-button"
                              // arial-label="rate 2"
                              data-text="2"
                            />
                          </li>
                        </div>
                        <h6>No pain</h6>
                      </div>

                      <div className="scrDiv">
                        <div className="scroli">
                          <li>
                            <input
                              type="radio"
                              name="recommend"
                              className="radio-button"
                              // arial-label="rate 3"
                              data-text="3"
                            />
                          </li>
                          <li>
                            <input
                              type="radio"
                              name="recommend"
                              className="radio-button"
                              // arial-label="rate 4"
                              data-text="4"
                            />
                          </li>
                        </div>
                        <h6>Low</h6>
                      </div>

                      <div className="scrDiv">
                        <div className="scroli">
                          <li>
                            <input
                              type="radio"
                              name="recommend"
                              className="radio-button"
                              // arial-label="rate 5"
                              data-text="5"
                            />
                          </li>
                          <li>
                            <input
                              type="radio"
                              name="recommend"
                              className="radio-button"
                              // arial-label="rate 6"
                              data-text="6"
                            />
                          </li>
                        </div>
                        <h6>Moderate</h6>
                      </div>

                      <div className="scrDiv">
                        <div className="scroli">
                          <li>
                            <input
                              type="radio"
                              name="recommend"
                              className="radio-button"
                              // eslint-disable-next-line react/no-unknown-property
                              // arial-label="rate 7"
                              data-text="7"
                            />
                          </li>
                          <li>
                            <input
                              type="radio"
                              name="recommend"
                              className="radio-button"
                              // eslint-disable-next-line react/no-unknown-property
                              // arial-label="rate 8"
                              data-text="8"
                            />
                          </li>
                        </div>
                        <h6>Significant</h6>
                      </div>

                      <div className="scrDiv">
                        <div className="scroli">
                          <li>
                            <input
                              type="radio"
                              name="recommend"
                              className="radio-button"
                              // arial-label="rate 9"
                              data-text="9"
                            />
                          </li>
                          <li>
                            <input
                              type="radio"
                              name="recommend"
                              className="radio-button"
                              // arial-label="rate 10"
                              data-text="10"
                            />
                          </li>
                        </div>
                        <h6>Intense</h6>
                      </div>
                    </ol>
                  </div>
                </div>

                <div className="">
                  <h6 className="emltext">Notes</h6>
                  <TextAreaDiv Arealabl="Add your assessment notes. This will be shared with the pet owner." />
                </div>
              </div>

              <div className="PresDiv">
                <TextSpan Textname="Prescription" />
                <TextAreaDiv Arealabl="Add details" />
              </div>

              <div className="Upld">
                <h5>OR Upload</h5>
                <UplodeImage />
              </div>

              <MainBtn bimg={whtcheck} btext="Mark as Complete" optclas="opt" />
            </div>

            <div className="RytContent">
              <div className="RytContDetails">
                <div className="ownerImg">
                  <img src={pet1} alt="" />
                  <div className="owndetl">
                    <h4>Kizie</h4>
                    <p>Beagle</p>
                  </div>
                </div>

                <div className="PopOwnerDetail">
                  <div className="popowneritems">
                    <h5>Gender</h5>
                    <h4>Female</h4>
                  </div>
                  <div className="popowneritems">
                    <h5>Age</h5>
                    <h4>3 Years</h4>
                  </div>
                  <div className="popowneritems">
                    <h5>Neutered</h5>
                    <h4>Yes</h4>
                  </div>
                  <div className="popowneritems">
                    <h5>Weight</h5>
                    <h4>28.66lbs</h4>
                  </div>
                </div>

                <MainBtn bimg={whtmsg} btext="Message Owner" optclas="" />
              </div>

              <ChatApp />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// TextArea

TextAreaDiv.propTypes = {
  Arealabl: PropTypes.string,
};
export function TextAreaDiv({ Arealabl }) {
  return (
    <div className="form-floating">
      <textarea
        className="form-control"
        placeholder="Leave a comment here"
        id="floatingTextarea2"
      ></textarea>
      <label htmlFor="floatingTextarea2">{Arealabl}</label>
    </div>
  );
}

// Main Btn
export function MainBtn({
  bimg,
  btext,
  optclas,
  mdtarget,
  onClick,
  btntyp,
  disabled,
}) {
  return (
    <div className={`ModlMainbtn ${optclas}`}>
      <button
        type={btntyp}
        disabled={disabled}
        {...(mdtarget
          ? { 'data-bs-toggle': 'modal', 'data-bs-target': mdtarget }
          : {})}
        onClick={onClick}
      >
        {bimg && <img src={bimg} alt="button icon" />} {btext}
      </button>
    </div>
  );
}

MainBtn.propTypes = {
  bimg: PropTypes.string,
  btext: PropTypes.string,
  optclas: PropTypes.string,
  mdtarget: PropTypes.string,
  btntyp: PropTypes.string,
  onClick: PropTypes.func, // ✅ Fix here
  disabled: PropTypes.bool,
};

MainBtn.defaultProps = {
  optclas: '',
  disabled: false,
};
// AppointCard start
AppointCard.propTypes = {
  crdimg: PropTypes.string,
  cdowner: PropTypes.string,
  crdtpe: PropTypes.string,
  btntext: PropTypes.string,
  btnimg: PropTypes.string,
  crddoctor: PropTypes.string,
  crddodrjobctor: PropTypes.string,
  drjob: PropTypes.string,
  CardbtnClass: PropTypes.string,
};

export function AppointCard({
  crdimg,
  cdowner,
  crdtpe,
  btntext,
  btnimg,
  crddoctor,
  drjob,
  CardbtnClass,
}) {
  return (
    <div className="Confcard">
      <div className="cardTopInner">
        <img src={crdimg} alt="cardimg" />
        <div className="Sideinner">
          <h6>{cdowner}</h6>
          <p>
            <i className="ri-user-fill"></i> {crdtpe}
          </p>
        </div>
      </div>
      <div className="midinner">
        <h4>{crddoctor}</h4>
        <p>{drjob}</p>
      </div>
      <div className={`cardbtn ${CardbtnClass}`}>
        <button
          type="button"
          data-bs-toggle="modal"
          data-bs-target="#DashModal"
        >
          <img src={btnimg} alt="" /> {btntext}
        </button>
      </div>
    </div>
  );
}

// CardHead Text
CardHead.propTypes = {
  Cdtxt: PropTypes.string,
  Cdnumb: PropTypes.string,
  CdNClas: PropTypes.string,
};

export function CardHead({ Cdtxt, Cdnumb, CdNClas }) {
  return (
    <div className="DashcardText">
      <h6>{Cdtxt}</h6>
      <h6 className={CdNClas}>{Cdnumb}</h6>
    </div>
  );
}
