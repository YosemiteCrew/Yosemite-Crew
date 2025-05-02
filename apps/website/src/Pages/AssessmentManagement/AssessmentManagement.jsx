
import React, { useCallback, useEffect, useState } from 'react';
import "./AssessmentManagement.css";
import { BoxDiv, DivHeading, ListSelect, TopHeading } from "../Dashboard/page";
import { getData, putData} from '../../services/apiService';
// import Topic from "../../../../public/Images/topic.png";
import PropTypes from "prop-types";
// import box2 from "../../../../public/Images/box2.png"
// import box4 from "../../../../public/Images/box4.png"
// import box5 from "../../../../public/Images/box5.png"
// import Accpt from "../../../../public/Images/acpt.png";
// import Decln from "../../../../public/Images/decline.png";
import AssessmentsTable from "../../Components/ActionsTable/AssessmentsTable";
import { DashModal } from "../Appointment/page";
// import btn1 from "../../../../public/Images/btn1.png"
// import btn2 from "../../../../public/Images/btn2.png"
// import btn3 from "../../../../public/Images/btn3.png"
// import btn4 from "../../../../public/Images/btn4.png"
// import pet1 from "../../../../public/Images/pet1.png"

import  {FhirDataConverter}  from '../../utils/FhirDataConverter';
import Swal from "sweetalert2";
import { useAuth } from "../../context/useAuth";
import { Link, useNavigate } from "react-router-dom";
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import enUS from 'date-fns/locale/en-US';




const AssessmentManagement = () => {
    // dropdown
  const { userId, userType, onLogout } = useAuth();
  const navigate = useNavigate();


  const fhir_converter = new FhirDataConverter();
  const optionsList1 = ['Last 7 Days', 'Last 10 Days', 'Last 20 Days', 'Last 21 Days'];
  const assessmentTypeList = ['All', 'Grimace Scale', 'Parasiticide Risk', 'Pain Assessment'];

  const locales = {
    'en-US': enUS,
  };


  const [assessments, setAssessments] = useState([]);
  const [newAssessment, setNewAssessment] = useState(0);
  const [completed, setCompleted] = useState([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [cancelled, setCancelled] = useState([]);
  const [cancelledCount, setCancelledCount] = useState(0);
  const [confirmed, setConfirmed] = useState([]);
  const [confirmedCount, setConfirmedCount] = useState(0);
  const [page, setPage] = useState(0);
  const [assessmentStatus, setAssessmentStatus] = useState("New");
  const [days, setDays] = useState(7);
  const [assessmentType, setAssessmentType] = useState('All');

  
    const fetchNewAssessments = async (offset, limit, status, userId) => {
      try {
        await getData(`fhir/v1/assessments?organization=Hospital/${userId}&offset=${offset}&limit=${limit}&type=list&status=${status}&days=${days}&assessment_type=${assessmentType}`)
        .then(res => {
          if (res.status === 200 && res.data.status === 1) {
            let data = res.data;
            const nomaldata = fhir_converter.assessmentsData(data);
            
            if(status =="New"){
              setAssessments(nomaldata);
              setNewAssessment(data.total);
            }
            if(status =="Confirmed"){
              setConfirmed(nomaldata);
              setConfirmedCount(data.total);
            }
            if(status =="Completed"){
              setCompleted(nomaldata);
              setCompletedCount(data.total);
            }
            if(status =="Cancelled"){
               setCancelled(nomaldata);
               setCancelledCount(data.total);
            }
          }
        });
      } catch (err) {
          Swal.fire({
                title: "Error",
                text: err,
                icon: "error",
              });
      }
    };




    const updateAssessments = async (id, status, offset) => {
      try {
        
        const fhir_data = fhir_converter.acceptAndcancel(id, status);
        await putData(`fhir/v1/assessments?type=updateStatus`, fhir_data).then(data => {

          if(data){
            setAssessmentStatus(status);
          }
        });
        
      } catch (err) {
          Swal.fire({
            title: "Error",
            text: err,
            icon: "error",
          });
      }
    };


    const changepage = async (page) => {
      setPage(page)
    };


    const filterByDays = async (selectedOption) => {

        const days = parseInt(selectedOption.match(/\d+/)[0], 10); 
        setDays(days);
    };


    const filterByAssessmentType = async (selectedOption) =>{ 
      setAssessmentType(selectedOption);

    }


  useEffect(() => {
    if(userId){
      fetchNewAssessments(page, 6, 'Confirmed', userId);
      fetchNewAssessments(page, 6, 'Completed', userId);
      fetchNewAssessments(page, 6, 'Cancelled', userId);
    }
  }, [assessmentStatus, assessmentType, days, userId]);

  useEffect(() => {
    if (userId) { fetchNewAssessments(0, 6, 'New', userId); }
    else{  onLogout(navigate); }
  }, [page, assessmentStatus, days, userId]);

  return (
 
      <section className="AssessmentManagementSec">
        <div className="container">
          <div className="MainDash">
            {/* Top Section */}
            <div className="AssMantTop">
              <TopHeading spantext="" heding="Assessment Management" notif={`${newAssessment} New Appointments`} />
              <button type="button" data-bs-toggle="modal" data-bs-target="#DashModall">
                <img src={`${import.meta.env.VITE_BASE_IMAGE_URL}/topic.png`} alt="Topic" /> Assessment Catalogue
              </button>
        
            </div>

            


            <div className="overviewDiv">
                <div className="OverviewTop">
                    <h5>Overview</h5>
                    <ListSelect options={optionsList1} onChange={filterByDays} />
                </div>
                <div className="overviewitem">
                    <BoxDiv boximg={`${import.meta.env.VITE_BASE_IMAGE_URL}/box4.png`} ovradcls=" fawndark" ovrtxt="New Assessments"  boxcoltext="frowntext" overnumb={newAssessment}   />
                    <BoxDiv boximg={`${import.meta.env.VITE_BASE_IMAGE_URL}/box5.png`} ovradcls=" cambrageblue" ovrtxt="Completed" boxcoltext="greentext" overnumb={ completedCount }  />
                    <BoxDiv boximg={`${import.meta.env.VITE_BASE_IMAGE_URL}/box2.png`} ovradcls=" purple" ovrtxt="Pending" boxcoltext="purpletext" overnumb={ confirmedCount}  />
                </div>
            </div>

            <div>
                <DivHeading TableHead="New Assessments" tablespan={newAssessment}/>
                <AssessmentsTable
                 actimg1={`${import.meta.env.VITE_BASE_IMAGE_URL}/acpt.png`} 
                 actimg2={`${import.meta.env.VITE_BASE_IMAGE_URL}/decline.png`}
                 assessments = {assessments }  
                 total={newAssessment} 
                 onClick={changepage}
                 onClicked={updateAssessments}/>
            </div>

            <div className="AllAssesmentDiv">

                <div className="s">
                <div className="OverviewTop">
                    <DivHeading TableHead="All Assessments " tablespan={ confirmedCount +  completedCount + cancelledCount} />
                    <ListSelect options={assessmentTypeList} onChange={filterByAssessmentType} />
                    </div>

                </div>

                <div className="DashCardData">

                    <div className="DashCardDiv">
                        <CardHead Cdtxt="Confirmed" Cdnumb={confirmedCount} CdNClas="fawn"/>
                        <div className="DashCardItem fawnbg">
                          
                                            {confirmed.map((assessment, index) => (
                                              <div
                                                ref={
                                                  index === assessment.length - 1
                                                    ? lastConfirmedAppointmentRef
                                                    : null
                                                }
                                                key={index}
                                              >
                                                <AssessmentCard
                                                  crdimg={`${import.meta.env.VITE_BASE_IMAGE_URL}/pet1.png`}
                                                  cdowner={assessment.ownerName}
                                                  crdtpe={assessment.petName}
                                                  btnimg={`${import.meta.env.VITE_BASE_IMAGE_URL}/btn1.png`}
                                                  btntext={assessment.assessment_type}
                                                  crddoctor={assessment.doctorName}
                                                  drjob={assessment.department}
                                                  CardbtnClass="btnfown"
                                                />
                                              </div>
                                            ))}
                                    </div>
                    </div>

                    <div className="DashCardDiv">
                        <CardHead Cdtxt="Completed" Cdnumb={completedCount} CdNClas="ltgren"/>
                        <div className="DashCardItem greenbg">
                                       {completed.map((assessment, index) => (
                                              <div
                                                ref={
                                                  index === assessment.length - 1
                                                    ? lastConfirmedAppointmentRef
                                                    : null
                                                }
                                                key={index}
                                              >
                                                <AssessmentCard
                                                  crdimg={`${import.meta.env.VITE_BASE_IMAGE_URL}/pet1.png`}
                                                  cdowner={assessment.ownerName}
                                                  crdtpe={assessment.petName}
                                                  btnimg={`${import.meta.env.VITE_BASE_IMAGE_URL}/btn3.png`}
                                                  btntext={assessment.assessment_type}
                                                  crddoctor={assessment.doctorName}
                                                  drjob={assessment.department}
                                                  CardbtnClass="btngreen"
                                                />
                                              </div>
                                            ))}
                            {/* <AssessmentCard crdimg={`${import.meta.env.VITE_BASE_IMAGE_URL}/pet1.png`} cdowner="Bella" crdtpe="Sarah Johnson" btnimg={`${import.meta.env.VITE_BASE_IMAGE_URL}/btn3.png`} btntext="Tuesday, 10 Sep - 11:00 AM" crddoctor="Dr. Michael Lee" drjob="Orthopedics" CardbtnClass="btngreen"/>
                            <AssessmentCard crdimg={`${import.meta.env.VITE_BASE_IMAGE_URL}/pet1.png`} cdowner="Max" crdtpe="David Martin" btnimg={`${import.meta.env.VITE_BASE_IMAGE_URL}/btn3.png`} btntext="Tuesday, 10 Sep - 11:00 AM" crddoctor="Dr. Olivia Harris" drjob="Neurology" CardbtnClass="btngreen"/>
                            <AssessmentCard crdimg={`${import.meta.env.VITE_BASE_IMAGE_URL}/pet1.png`} cdowner="Max" crdtpe="David Martin" btnimg={`${import.meta.env.VITE_BASE_IMAGE_URL}/btn3.png`} btntext="Tuesday, 10 Sep - 11:00 AM" crddoctor="Dr. Olivia Harris" drjob="Neurology" CardbtnClass="btngreen"/> */}
                        </div>
                    </div>

                    <div className="DashCardDiv">
                        <CardHead Cdtxt="Cancelled" Cdnumb={cancelledCount} CdNClas="chill"/>
                        <div className="DashCardItem chillybg">
                            {cancelled.map((assessment, index) => (
                                              <div
                                                ref={
                                                  index === assessment.length - 1
                                                    ? lastConfirmedAppointmentRef
                                                    : null
                                                }
                                                key={index}
                                              >
                                                <AssessmentCard
                                                  crdimg={`${import.meta.env.VITE_BASE_IMAGE_URL}/pet1.png`}
                                                  cdowner={assessment.ownerName}
                                                  crdtpe={assessment.petName}
                                                  btnimg={`${import.meta.env.VITE_BASE_IMAGE_URL}/btn4.png`}
                                                  btntext={assessment.assessment_type}
                                                  crddoctor={assessment.doctorName}
                                                  drjob={assessment.department}
                                                  CardbtnClass="btnchilly"
                                                />
                                              </div>
                                            ))}
                            {/* <AssessmentCard crdimg={`${import.meta.env.VITE_BASE_IMAGE_URL}/pet1.png`} cdowner="Bella" crdtpe="Sarah Johnson" btnimg={`${import.meta.env.VITE_BASE_IMAGE_URL}/btn4.png`} btntext="Tuesday, 10 Sep - 11:00 AM" crddoctor="Dr. Michael Lee" drjob="Orthopedics" CardbtnClass="btnchilly"/>
                            <AssessmentCard crdimg={`${import.meta.env.VITE_BASE_IMAGE_URL}/pet1.png`} cdowner="Max" crdtpe="David Martin" btnimg={`${import.meta.env.VITE_BASE_IMAGE_URL}/btn4.png`} btntext="Tuesday, 10 Sep - 11:00 AM" crddoctor="Dr. Olivia Harris" drjob="Neurology" CardbtnClass="btnchilly"/> */}
                        </div>
                    </div>

                    <DashModal/>

                </div>


            </div>

            {/* Modal Component */}
            <AsstCateModal />

           

          </div>
        </div>
      </section>

  );
};

export default AssessmentManagement;

// Modal Component
export function AsstCateModal({ AsstCate = [] }) {
  const defaultAppointments = [
    {
    AsstName: "Feline Grimace Scale",
    Cate: "Behavior & Pain",
    Descrp: "A facial expression-based tool to evaluate pain in cats.",
    Sutable: "Cats"
    },
    {
    AsstName: "Feline Grimace Scale",
    Cate: "Behavior & Pain",
    Descrp: "A facial expression-based tool to evaluate pain in cats.",
    Sutable: "Cats"
    },
    {
    AsstName: "Feline Grimace Scale",
    Cate: "Behavior & Pain",
    Descrp: "A facial expression-based tool to evaluate pain in cats.",
    Sutable: "Cats",
    },
    {
    AsstName: "Feline Grimace Scale",
    Cate: "Behavior & Pain",
    Descrp: "A facial expression-based tool to evaluate pain in cats.",
    Sutable: "Cats"
    },
    {
    AsstName: "Feline Grimace Scale",
    Cate: "Behavior & Pain",
    Descrp: "A facial expression-based tool to evaluate pain in cats.",
    Sutable: "Cats"
    },
  ];

  // Render the passed data or fallback to default
  const dataToRender = AsstCate.length > 0 ? AsstCate : defaultAppointments;

  return (
    <div className="AstManageCardModal">
      <div
        className="modal fade"
        id="DashModall"
        tabIndex="-1"
        aria-labelledby="DashModalLabel"
        aria-hidden="true"
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="AssessmentCatalogueDiv">

              <h3>Assessment Catalogue</h3>

              {/* Table Section */}
              <div className="AsstmntTableDiv">
                <table className="Asstmnttable">
                  <thead>
                    <tr>
                      <th scope="col"></th>
                      <th scope="col">Assessment Name</th>
                      <th scope="col">Category</th>
                      <th scope="col">Description</th>
                      <th scope="col">Suitable For</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dataToRender.map((item, index) => (
                      <tr key={index}>

                        <td>
                            <input className="form-check-input" type="checkbox" role="switch" id="flexSwitchCheckDefault"/>
                        </td>
                        <td>{item.AsstName}</td>
                        <td>{item.Cate}</td>
                        <td>{item.Descrp}</td>
                        <td>{item.Sutable}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Buttons */}
              <div className="AstCatalgBtn">
                <a href="/#"><i className="ri-file-add-fill"></i> Suggest an Assessment</a>
                <a href="/#"><i className="ri-shield-check-fill"></i> Update Catalogue</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Prop Validation
AsstCateModal.propTypes = {
  AsstCate: PropTypes.arrayOf(
    PropTypes.shape({
        AsstName: PropTypes.string.isRequired,
        Cate: PropTypes.string.isRequired,
        Descrp: PropTypes.string.isRequired,
        Sutable: PropTypes.string.isRequired,
    })
  ),
};



// AssessmentCard start
AssessmentCard.propTypes = {
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

export function AssessmentCard({
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
          <h6>{crdtpe }</h6>
          <p>
            <i className="ri-user-fill"></i> {cdowner}
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



