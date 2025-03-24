
import React from "react";
import "./AssessmentManagement.css";
import { BoxDiv, DivHeading, ListSelect, TopHeading } from "../Dashboard/page";
// import Topic from "../../../../public/Images/topic.png";
import PropTypes from "prop-types";
// import box2 from "../../../../public/Images/box2.png"
// import box4 from "../../../../public/Images/box4.png"
// import box5 from "../../../../public/Images/box5.png"
// import Accpt from "../../../../public/Images/acpt.png";
// import Decln from "../../../../public/Images/decline.png";
import ActionsTable from "../../Components/ActionsTable/ActionsTable";
import { AppointCard, CardHead, DashModal } from "../Appointment/page";
// import btn1 from "../../../../public/Images/btn1.png"
// import btn2 from "../../../../public/Images/btn2.png"
// import btn3 from "../../../../public/Images/btn3.png"
// import btn4 from "../../../../public/Images/btn4.png"
// import pet1 from "../../../../public/Images/pet1.png"




const AssessmentManagement = () => {
    // dropdown 
  const optionsList1 = ['Last 7 Days', 'Last 10 Days', 'Last 20 Days', 'Last 21 Days'];

  return (
 
      <section className="AssessmentManagementSec">
        <div className="container">
          <div className="MainDash">
            {/* Top Section */}
            <div className="AssMantTop">
              <TopHeading spantext="" heding="Assessment Management" notif="8 New Appointments" />
              <button type="button" data-bs-toggle="modal" data-bs-target="#DashModall">
                <img src={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/topic.png`} alt="Topic" /> Assessment Catalogue
              </button>
            </div>

            


            <div className="overviewDiv">
                <div className="OverviewTop">
                    <h5>Overview</h5>
                    <ListSelect options={optionsList1} />
                </div>
                <div className="overviewitem">
                    <BoxDiv boximg={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/box4.png`} ovradcls=" fawndark" ovrtxt="New Appointments"  boxcoltext="frowntext" overnumb="12"   />
                    <BoxDiv boximg={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/box5.png`} ovradcls=" cambrageblue" ovrtxt="Completed" boxcoltext="greentext" overnumb="08"  />
                    <BoxDiv boximg={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/box2.png`} ovradcls=" purple" ovrtxt="Pending" boxcoltext="purpletext" overnumb="02"  />
                </div>
            </div>

            <div>
                <DivHeading TableHead="New Assessments" tablespan="(3)" />
                <ActionsTable actimg1={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/acpt.png`} actimg2={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/decline.png`} />
            </div>

            <div className="AllAssesmentDiv">

                <div className="s">
                    <DivHeading TableHead="All Assessments " tablespan="(8)" />

                </div>

                <div className="DashCardData">

                    <div className="DashCardDiv">
                        <CardHead Cdtxt="Confirmed" Cdnumb="03" CdNClas="fawn"/>
                        <div className="DashCardItem fawnbg">
                            <AppointCard crdimg={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/pet1.png`} cdowner="Kizie" crdtpe="Sky B" btnimg={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/btn1.png`} btntext="Tuesday, 10 Sep - 11:00 AM" crddoctor="Dr. Emily Johnson" drjob="Cardiology" CardbtnClass="btnfown"/>
                            <AppointCard crdimg={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/pet1.png`} cdowner="Max" crdtpe="David Martin" btnimg={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/btn1.png`} btntext="Tuesday, 10 Sep - 11:00 AM" crddoctor="Dr. Olivia Harris" drjob="Neurology" CardbtnClass="btnfown"/>
                            <AppointCard crdimg={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/pet1.png`} cdowner="Molly" crdtpe="Lucas Miller" btnimg={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/btn1.png`} btntext="Tuesday, 10 Sep - 11:00 AM" crddoctor="Dr. Grace Walker" drjob="Dentistry" CardbtnClass="btnfown"/>
                        </div>
                    </div>

                    <div className="DashCardDiv">
                        <CardHead Cdtxt="Completed" Cdnumb="02" CdNClas="ltgren"/>
                        <div className="DashCardItem greenbg">
                            <AppointCard crdimg={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/pet1.png`} cdowner="Bella" crdtpe="Sarah Johnson" btnimg={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/btn3.png`} btntext="Tuesday, 10 Sep - 11:00 AM" crddoctor="Dr. Michael Lee" drjob="Orthopedics" CardbtnClass="btngreen"/>
                            <AppointCard crdimg={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/pet1.png`} cdowner="Max" crdtpe="David Martin" btnimg={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/btn3.png`} btntext="Tuesday, 10 Sep - 11:00 AM" crddoctor="Dr. Olivia Harris" drjob="Neurology" CardbtnClass="btngreen"/>
                            <AppointCard crdimg={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/pet1.png`} cdowner="Max" crdtpe="David Martin" btnimg={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/btn3.png`} btntext="Tuesday, 10 Sep - 11:00 AM" crddoctor="Dr. Olivia Harris" drjob="Neurology" CardbtnClass="btngreen"/>
                        </div>
                    </div>

                    <div className="DashCardDiv">
                        <CardHead Cdtxt="Cancelled" Cdnumb="02" CdNClas="chill"/>
                        <div className="DashCardItem chillybg">
                            <AppointCard crdimg={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/pet1.png`} cdowner="Bella" crdtpe="Sarah Johnson" btnimg={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/btn4.png`} btntext="Tuesday, 10 Sep - 11:00 AM" crddoctor="Dr. Michael Lee" drjob="Orthopedics" CardbtnClass="btnchilly"/>
                            <AppointCard crdimg={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/pet1.png`} cdowner="Max" crdtpe="David Martin" btnimg={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/btn4.png`} btntext="Tuesday, 10 Sep - 11:00 AM" crddoctor="Dr. Olivia Harris" drjob="Neurology" CardbtnClass="btnchilly"/>
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
