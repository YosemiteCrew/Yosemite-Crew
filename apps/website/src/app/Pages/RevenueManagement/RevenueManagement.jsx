
import React from "react";
import "./RevenueManagement.css";
import { Col, Container, ProgressBar, Row } from "react-bootstrap";
import { ListSelect } from "../Dashboard/page";
import { IoArrowUpCircle, IoArrowDownCircle } from "react-icons/io5";
import { Doughnut } from "react-chartjs-2";
import { ArcElement, Chart as ChartJS, Tooltip, Legend } from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

function RevenueManagement() {
  // Data for the donut chart
  const donutData = {
    labels: ["Inactive", "Active"],
    datasets: [
      {
        data: [2421, 1057],
        backgroundColor: ["#FDBD74", "#D04122"],
        hoverBackgroundColor: ["#FDBD74", "#D04122"],
      },
    ],
  };

  // Data for the gauge charts
  const gaugeVaccinated = {
    datasets: [
      {
        data: [90, 10], // Vaccinated percentage
        backgroundColor: ["#82E0AA", "#E8F8F5"], // Green and Light Green
        cutout: "80%",
        borderWidth: 0,
      },
    ],
  };

  const gaugeNeutered = {
    datasets: [
      {
        data: [72, 28], // Neutered percentage
        backgroundColor: ["#A9CCE3", "#EBF5FB"], // Purple and Light Purple
        cutout: "80%",
        borderWidth: 0,
      },
    ],
  };

  // Chart options
  const gaugeOptions = {
    rotation: 270,
    circumference: 180,
    plugins: {
      tooltip: { enabled: false },
      legend: { display: false },
    },
  };

  // Dropdown options
  const optionsList = [
    "Last 30 Days",
    "Last 15 Days",
    "Last 10 Days",
    "Last 6 Days",
  ];

  return (

      <section className="RevenueDashBoardSec">
        <Container>
          <div className="RevnewDashBoardData">
            <div className="RevnDashDiv">
              <div className="TopRevnew">
                <h2>Revenue Dashboard</h2>
                <ListSelect options={optionsList} />
              </div>
              <div className="RevenueBox">
                <div className="RevneueBoxItem">
                  <p>Total Income</p>
                  <h3>$44,130</h3>
                  <div className="btmpara">
                    <IoArrowUpCircle className="grn" />
                    <span className="grn">12.78%</span>
                    <p>vs. previous 30 days</p>
                  </div>
                </div>
                <div className="RevneueBoxItem">
                  <p>IPD Income</p>
                  <h3>$10,945</h3>
                  <div className="btmpara">
                    <IoArrowUpCircle className="grn" />
                    <span className="grn">4.63%</span>
                    <p>vs. previous 30 days</p>
                  </div>
                </div>
                <div className="RevneueBoxItem">
                  <p>OPD Income</p>
                  <h3>$12,338</h3>
                  <div className="btmpara">
                    <IoArrowDownCircle className="red" />
                    <span className="red">2.34%</span>
                    <p>vs. previous 30 days</p>
                  </div>
                </div>
                <div className="RevneueBoxItem">
                  <p>Laboratory Income</p>
                  <h3>$20,847</h3>
                  <div className="btmpara">
                    <IoArrowUpCircle className="grn" />
                    <span className="grn">8.98%</span>
                    <p>vs. previous 30 days</p>
                  </div>
                </div>
              </div>
            </div>

            <Row>
              <Col md={6}>
                <div className="ExpensivDiv">
                  <div className="topexpensive">
                    <h5>Income vs Expenses</h5>
                    <ListSelect options={optionsList} />
                  </div>
                  <div className="expensiveGraph"></div>
                </div>
              </Col>
              <Col md={6}>
                <div className="DepartmentDiv">
                  <div className="topexpensive">
                    <h5>Department-wise Income</h5>
                    <ListSelect options={optionsList} />
                  </div>
                  <div className="DepartIncomDiv">
                    <div className="DeprtInner">
                      <div className="onclogydiv">
                        <div className="departText">
                          <p>Oncology</p>
                          <h5>$9,700</h5>
                        </div>
                      </div>

                      <div className="intrmedcndiv">
                        <div className="departText">
                          <p>Internal Medicine</p>
                          <h5>$7,500</h5>
                        </div>
                      </div>

                      <div className="Orthopedicsdiv">
                        <div className="departText">
                          <p>Orthopedics</p>
                          <h5>$6,200</h5>
                        </div>
                      </div>

                      <div className="Gastroenterologydiv">
                        <div className="departText">
                          <p>Gastroenterology</p>
                          <h5>$6,500</h5>
                        </div>
                      </div>

                      <div className="Cardiologydiv">
                        <div className="departText">
                          <p>Cardiology</p>
                          <h5>$9,700</h5>
                        </div>
                      </div>

                      <div className="Neurologydiv">
                        <div className="departText">
                          <p>Neurology</p>
                          <h5>$6,230</h5>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Col>
            </Row>

            <Row>
              <Col md={5}>
                <div className="InsuredPetDiv">
                  <div className="InsuredHead">
                    <h6>Insured vs Non-insured pets</h6>
                    <ListSelect options={optionsList} />
                  </div>
                </div>
              </Col>
              <Col md={3}>
                <div className="InsuredPetDiv">
                  <div className="InsuredHead">
                    <h6>Plan-wise Breakdown</h6>
                  </div>
                </div>
              </Col>
              <Col md={4}>
                <div className="InsuredPetDiv">
                  <div className="InsuredHead">
                    <h6>Plans Sign-ups</h6>
                    <ListSelect options={optionsList} />
                  </div>
                </div>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <div className="InsuredPetDiv">
                  <div className="topexpensive">
                    <h5>Aged Debt Reports</h5>
                  </div>
                </div>
              </Col>
              <Col md={3}>
                <div className="InsuredPetDiv">
                  <div className="topexpensive">
                    <h5>Top Sellers</h5>
                    <ListSelect options={optionsList} />
                  </div>

                  <div className="SellersDiv">
                    <div className="sellerProgrss">
                      <div className="prgrshead">
                        <h6>Wellness Check-ups</h6>
                        <h6>$48,247</h6>
                      </div>
                      <ProgressBar now={90} />
                    </div>

                    <div className="sellerProgrss">
                      <div className="prgrshead">
                        <h6>Dental Cleaning</h6>
                        <h6>$25,748</h6>
                      </div>
                      <ProgressBar now={50} />
                    </div>

                    <div className="sellerProgrss">
                      <div className="prgrshead">
                        <h6>Vaccinations</h6>
                        <h6>$21,358</h6>
                      </div>
                      <ProgressBar now={40} />
                    </div>

                    <div className="sellerProgrss">
                      <div className="prgrshead">
                        <h6>Assessments</h6>
                        <h6>$20,873</h6>
                      </div>
                      <ProgressBar now={35} />
                    </div>
                  </div>
                </div>
              </Col>
              <Col md={3}>
                <div className="InsuredPetDiv">
                  <div className="topexpensive">
                    <h5>Loss Leaders</h5>
                    <ListSelect options={optionsList} />
                  </div>

                  <div className="SellersDiv">
                    <div className="sellerProgrss LossProgress">
                      <div className="prgrshead">
                        <h6>Microchipping</h6>
                        <h6>$9,528</h6>
                      </div>
                      <ProgressBar now={50} />
                    </div>

                    <div className="sellerProgrss LossProgress">
                      <div className="prgrshead">
                        <h6>Routine Blood Screening</h6>
                        <h6>$7,218</h6>
                      </div>
                      <ProgressBar now={40} />
                    </div>

                    <div className="sellerProgrss LossProgress">
                      <div className="prgrshead">
                        <h6>Basic Grooming</h6>
                        <h6>$3,752</h6>
                      </div>
                      <ProgressBar now={30} />
                    </div>

                    <div className="sellerProgrss LossProgress">
                      <div className="prgrshead">
                        <h6>Deworming Treatment</h6>
                        <h6>$1,071</h6>
                      </div>
                      <ProgressBar now={20} />
                    </div>
                  </div>
                </div>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <div className="InsuredPetDiv">
                  <div className="topexpensive">
                    <h5>Client Base</h5>
                    <ListSelect options={optionsList} />
                  </div>
                </div>
              </Col>
              <Col md={3}>
                <div className="InsuredPetDiv">
                  <div className="topexpensive">
                    {/* <h5></h5> */}
                  </div>
                </div>
              </Col>
              <Col md={3}>
                <div className="InsuredPetDiv">
                  <div className="topexpensive">
                    {/* <h5></h5> */}
                  </div>
                </div>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <div className="InsuredPetDiv">
                  <div className="topexpensive">
                    {/* <h5></h5> */}
                  </div>

                  <div className="PetChartData">
                    <div className="clientPiaChart">
                      <div className="Clienttext">
                        <h6>Total Clients</h6>
                        <h6>3,478</h6>
                      </div>
                      <Doughnut data={donutData} />
                      <div className="piabtm">
                        <div className="actv">
                          <p>
                            <span className="red"></span> Active
                          </p>
                          <h6>2421</h6>
                        </div>
                        <div className="actv">
                          <p>
                            <span className="grn"></span> Inactive
                          </p>
                          <h6>1057</h6>
                        </div>
                      </div>
                    </div>

                    <div className="PetVactnedDiv">
                      <div className="PetVaccant">
                        <h5>Pets Vaccinated</h5>
                        <Doughnut
                          data={gaugeVaccinated}
                          options={gaugeOptions}
                        />
                      </div>
                      <div className="PetNeterd">
                        <h5>Pets Neutered</h5>
                        <Doughnut data={gaugeNeutered} options={gaugeOptions} />
                      </div>
                    </div>
                  </div>
                </div>
              </Col>
              <Col md={6}>
                <div className="InsuredPetDiv">
                  <div className="topexpensive">
                    <h5>Individual Vet Revenue</h5>
                    <ListSelect options={optionsList} />
                  </div>
                </div>
              </Col>
            </Row>
          </div>
        </Container>
      </section>
   
  );
}

export default RevenueManagement;
