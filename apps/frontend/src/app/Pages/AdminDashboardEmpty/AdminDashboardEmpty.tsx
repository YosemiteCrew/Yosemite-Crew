"use client";
import React, { useState } from "react";
import "./AdminDashboardEmpty.css";
import ExploringCard from "@/app/Components/ExploringCard/ExploringCard";
import { Button, Col, Container, Dropdown, Row } from "react-bootstrap";
import Link from "next/link";
import { IoMdEye } from "react-icons/io";
import { FaBellSlash} from "react-icons/fa";
import { PiWarningOctagonFill } from "react-icons/pi";
import { AiFillPlusCircle } from "react-icons/ai";
import StatCard from "@/app/Components/StatCard/StatCard";
import DynamicChartCard from "@/app/Components/BarGraph/DynamicChartCard";
import BlankDonutCard from "@/app/Components/BarGraph/BlankDonutCard";








function AdminDashboardEmpty() {
  const [status, setStatus] = useState<"appointment" | "warning" | "verify">("appointment");// set to desired default
  const [linkClicked, setLinkClicked] = useState(false);
  const [selectedRange, setSelectedRange] = useState("Last 6 Months");// graphSelected 

  const handleSubscribeClick = () => {
    setStatus("warning");
    setLinkClicked(true);
  };

  // Empty Bar graph Stared  
  const blankData = [
    { month: "March", Completed: 0, Cancelled: 0 },
    { month: "April", Completed: 0, Cancelled: 0 },
    { month: "May", Completed: 0, Cancelled: 0 },
    { month: "June", Completed: 0, Cancelled: 0 },
    { month: "July", Completed: 0, Cancelled: 0 },
    { month: "August", Completed: 0, Cancelled: 0 },
  ];
  const blankRevenue = [
    { month: "March", Revenue: 0 },
    { month: "April", Revenue: 0 },
    { month: "May", Revenue: 0 },
    { month: "June", Revenue: 0 },
    { month: "July", Revenue: 0 },
    { month: "August", Revenue: 0 },
  ];
  // Empty Bar graph Ended  


 

  return (
    <section>
      {/* SubscribePopup */}
      <div className="SubscribePopup">
        <Container>
          <div className="SubsPopInner">
            <h4>📮 Stay in the Loop with Yosemite Crew</h4>
            <p>
              Get helpful tips, feature updates, and early access to new tools — straight to your inbox.{" "}
              <Link  href="#" className={linkClicked ? "clicked" : ""} onClick={handleSubscribeClick}>Subscribe Now →</Link>
            </p>
          </div>
        </Container>
      </div>

      <Container>
        <div className="EmptyDashboardData">


          <div className="WelcomEmptyDash">
            <div className="leftwlmdiv">
              <span>Welcome</span>
              <div className="wlcdash">
                <h2>Your Dashboard</h2>
                {/* Conditional Rendering */}
                {status === "appointment" && (
                  <div className="Apoitpopup">
                    <FaBellSlash /> No New Appointments
                  </div>
                )}

                {status === "warning" && (
                  <div className="Wrningpopup">
                    <PiWarningOctagonFill /> Verification in Progress — Limited Access Enabled
                  </div>
                )}
                {status === "verify" && (
                  <div className="Verifypopup">
                    🎉 Your profile is verified and good to go — no new appointments.
                  </div>
                )}
              </div>
              <p>Your central hub for insights, performance tracking and quick access to essential tools</p>
            </div>
            <div className="Ryttwlmdiv">
              <Button className={status === "verify" ? "full-opacity" : ""}><IoMdEye /> Manage Clinic Visibility</Button>
            </div>
          </div>

          {status === "appointment" && (
            <>
              <EmptySetupCard
                heading="Start by Setting Up Your Practice"
                description="Add your veterinary practice details at your own pace—jump in and explore the dashboard while you're at it."
                buttonText="Set up Your Practice"
                href="/completeprofile"
              />
             
            </>
          )}

          {status === "verify" && (
            <EmptySetupCard
              heading="Start by Inviting Your Team"
              description="Add your vets, assistants, or front desk staff to begin managing your clinic smoothly."
              buttonText="Invite Team Member"
              href="/dashboard/setup"
            />
          )}
          {/* Move ExploringCard to top if Subscribe clicked */}
            {linkClicked && (
              <ExploringCard
                Headtitle="Haven’t Set Up Everything Yet? —"
                Headtitlespan="Start Exploring Instead."
                Headpara="Get familiar with Yosemite Crew while you complete your setup at your own pace."
              />
            )}

          
          <div className="EmtyDivDash">

            <div>
              <Row>
                <Col md={3}><StatCard icon="/Images/stact2.png" title="Staff on-duty" value={122} /></Col>
                <Col md={3}><StatCard icon="/Images/stact1.png" title="Appointments (Today)" value={158} /></Col>
                <Col md={3}><StatCard icon="/Images/stact3.png" title="Inventory Out-of-Stock" value={45} /></Col>
                <Col md={3}><StatCard icon="/Images/stact4.png" title="Revenue (Today)" value="$7,298" /></Col>
              </Row>
            </div>

            <div>
              <Row>
                <Col md={6}>
                  <GraphSelected
                    title="Appointments"
                    options={["Last 3 Months", "Last 6 Months", "Last 1 Year"]}
                    selectedOption={selectedRange}
                    onSelect={setSelectedRange}/>
                  <DynamicChartCard  data={blankData}
                    keys={[
                      { name: "Completed", color: "#111" },
                      { name: "Cancelled", color: "#ccc" }
                    ]}
                  />
                </Col>

                <Col md={6}>
                  <GraphSelected
                    title="Revenue"
                    options={["Last 3 Months", "Last 6 Months", "Last 1 Year"]}
                    selectedOption={selectedRange}
                    onSelect={setSelectedRange}/>

                  <DynamicChartCard data={blankRevenue} type="line"
                    keys={[{ name: "Revenue", color: "#111" }]}
                    yTickFormatter={(v) => `$${v / 1000}K`}
                  />
                </Col>
              </Row>
            </div>

            <div className="DummyTable">
              <h5>Today’s Schedule <span>(0)</span></h5>
              <div className="TableDummyDiv">
                <div className="tblhed">
                  <h6>Name</h6>
                  <h6>Appointment ID</h6>
                  <h6>Reason for Appointment</h6>
                  <h6>Breed/Pet Type</h6>
                  <h6>Date</h6>
                  <h6>Doctor</h6>
                  <h6>Actions</h6>
                </div>
                <div className="tblbody">
                  <p>Looks like a quiet day… for now.</p>
                </div>
              </div>

            </div>

            <div className="DummyTable">
              <h5>Available Staff Today <span>(0)</span></h5>
              <div className="TableDummyDiv">
                <div className="tblhed">
                  <h6>Name</h6>
                  <h6>Week Working Hours</h6>
                  <h6>Appointments Today</h6>
                  <h6>Assessments Today</h6>
                  <h6>Status</h6>
                </div>
                <div className="tblbody">
                  <p>Looks like a quiet day… for now.</p>
                </div>
              </div>

            </div>

            <div className="DummyTable">
              <h5>Inventory <span>(0)</span></h5>
              <div className="TableDummyDiv">
                <div className="tblhed">
                  <h6>Name</h6>
                  <h6>Generic Name</h6>
                  <h6>SKU</h6>
                  <h6>Category</h6>
                  <h6>Manufacturer</h6>
                  <h6>Price</h6>
                  <h6>Manufacturer Price</h6>
                  <h6>Stock</h6>
                  <h6>Expiry Date</h6>
                </div>
                <div className="tblbody">
                  <p>Looks like a quiet day… for now.</p>
                </div>
              </div>

            </div>
            
            <div >
              <Row>
                <Col md={4}>
                  <BlankDonutCard
                    title="New Appointments"
                    labels={[
                      { text: 'App based Appointment', value: 0 },
                      { text: 'Walk In Appointment', value: 0 }
                    ]}
                  />
                </Col>
                <Col md={4}>

                  <BlankDonutCard
                    title="Emergency"
                    labels={[
                      { text: 'App based Emergency', value: 0 },
                      { text: 'Walk In Emergency', value: 0 }
                    ]}
                  />

                </Col>
                <Col md={4}>
                  <div className="WorkCard">
                    <StatCard icon="/Images/stact2.png" title="Week based Appointments" value="0000" />
                    <StatCard icon="/Images/stact2.png" title="Invoice Amount" value="$7,298" />
                  </div>
                </Col>
              </Row>
            </div>

          </div>

          {!linkClicked && (
            <ExploringCard
              Headtitle="Haven’t Set Up Everything Yet? —"
              Headtitlespan="Start Exploring Instead."
              Headpara="Get familiar with Yosemite Crew while you complete your setup at your own pace."
            />
          )}





          
        </div>
      </Container>
    </section>
  );
}

export default AdminDashboardEmpty;


// GraphSelectedProps
type GraphSelectedProps = {
  title: string;
  options: string[];
  selectedOption: string;
  onSelect: (option: string) => void;
}
export const GraphSelected: React.FC<GraphSelectedProps> = ({
  title,
  options,
  selectedOption,
  onSelect,
}) => {
  return (
    <div className="GraphSelectDiv mb-2">
      <h5>{title}</h5>
      <Dropdown className="DaysSelectDiv">
        <Dropdown.Toggle size="sm" variant="light">
          {selectedOption}
        </Dropdown.Toggle>
        <Dropdown.Menu>
          {options.map((option, index) => (
            <Dropdown.Item key={index} onClick={() => onSelect(option)}>
              {option}
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown>
    </div>
  );
};



// EmptySetupCard started 
type EmptySetupCardProps = {
  heading: string;
  description: string;
  buttonText: string;
  href: string;
};

const EmptySetupCard: React.FC<EmptySetupCardProps> = ({
  heading,
  description,
  buttonText,
  href,
}) => {
  return (
    <div className="EmptyPractice">
      <div className="Leftpractice">
        <h6>{heading}</h6>
        <p>{description}</p>
      </div>
      <div className="Rightpractice">
        <Link href={href}>
          <AiFillPlusCircle /> {buttonText}
        </Link>
      </div>
    </div>
  );
};

