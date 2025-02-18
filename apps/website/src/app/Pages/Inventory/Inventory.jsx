// eslint-disable-next-line no-unused-vars
import React from "react";
import "./Inventory.css";
import { Container, Form, Tab, Tabs } from "react-bootstrap";
import { BoxDiv, ListSelect } from "../Dashboard/page";
import box9 from "../../../../public/Images/box9.png";
import box10 from "../../../../public/Images/box10.png";
import box11 from "../../../../public/Images/box11.png";
import box12 from "../../../../public/Images/box12.png";
import WeeklyAppointmentsChart from "../../Components/BarGraph/WeeklyAppointmentsChart";
import DepartmentAppointmentsChart from "../../Components/BarGraph/DepartmentAppointmentsChart";
import { AiFillPlusCircle } from "react-icons/ai";
import { IoSearch } from "react-icons/io5";
import { Link } from "react-router-dom";
import ProcedureTable from "../../Components/ProcedureTable/ProcedureTable";
import Accpt from "../../../../public/Images/view.png";
import Decln from "../../../../public/Images/delete.png";
import ManageInvetryTable from "../../Components/ManageInvetryTable/ManageInvetryTable";

function Inventory() {
  // dropdown
  const optionsList1 = [
    "Last 7 Days",
    "Last 10 Days",
    "Last 20 Days",
    "Last 21 Days",
  ];
  const optionsList2 = [
    "Last 3 Months",
    "Last 6 Months",
    "Last 9 Months",
    "Last 12 Months",
  ];

  return (

      <section className="InventorySec">
        <Container>
          <div className="InventoryData">
            <div className="InvetHead">
              <h2>
                {" "}
                <span>Inventory</span> Overview
              </h2>
            </div>

            <div className="overviewDiv">
              <div className="OverviewTop">
                <h5></h5>
                <ListSelect options={optionsList1} />
              </div>
              <div className="overviewitem">
                <BoxDiv
                  boximg={box9}
                  ovradcls="purple "
                  ovrtxt="Total Inventory Items"
                  boxcoltext="purpletext "
                  overnumb="5,250"
                />
                <BoxDiv
                  boximg={box10}
                  ovradcls=" cambrageblue"
                  ovrtxt="Stock Value"
                  boxcoltext="greentext"
                  overnumb="$15,089"
                />
                <BoxDiv
                  boximg={box11}
                  ovradcls=" fawndark"
                  ovrtxt="Items Low on Stock"
                  boxcoltext="frowntext"
                  overnumb="320"
                />
                <BoxDiv
                  boximg={box12}
                  ovradcls=" chillibg"
                  ovrtxt="Out-of-Stock Items"
                  boxcoltext="ciltext"
                  overnumb="45"
                />
              </div>
            </div>

            <div className="InventoryGrph">
              <div className="Inventrygrphdiv">
                <div className="invtaprch">
                  <h6>Approaching Expiry</h6>
                </div>
                <WeeklyAppointmentsChart />
              </div>
              <div className="Inventrygrphdiv">
                <div className="invtaprch">
                  <h6>Category Breakdown</h6>
                  <ListSelect options={optionsList2} />
                </div>
                <DepartmentAppointmentsChart />
              </div>
            </div>

            <div className="ManageInvtDiv">
              <div className="ManageHead">
                <h2>
                  {" "}
                  <span>Manage</span> Inventory
                </h2>
                <Link to="/AddInventory">
                  <AiFillPlusCircle /> Add Inventory{" "}
                </Link>
              </div>

              <div className="ManageInvtTabs">
                <Tabs
                  defaultActiveKey="Pharmaceuticals"
                  id="justify-tab-example"
                  className="mb-3"
                >
                  <Tab eventKey="Pharmaceuticals" title="Pharmaceuticals">
                    <div className="InvttabsInner">
                      <div className="topInner">
                        <div className="lftinnr">
                          <div className="srchbr">
                            <Form.Control
                              type="text"
                              placeholder="Search anything"
                            />
                            <IoSearch />
                          </div>

                          <Form.Select aria-label="Default select example">
                            <option>Stock</option>
                            <option value="1">Stock One</option>
                            <option value="2">Stock Two</option>
                            <option value="3">Stock Three</option>
                          </Form.Select>
                          <Form.Select aria-label="Default select example">
                            <option>Expiry Date</option>
                            <option value="1">Expiry Date One</option>
                            <option value="2">Expiry Date Two</option>
                            <option value="3">Expiry Date Three</option>
                          </Form.Select>
                        </div>
                        <div className="Rytinnr">
                          <Form.Select aria-label="Default select example">
                            <option value="1">10</option>
                            <option value="2">20</option>
                            <option value="3">30</option>
                          </Form.Select>
                          <h6>Items</h6>
                        </div>
                      </div>
                      <ManageInvetryTable actimg1={Accpt} actimg2={Decln}/>
                    </div>
                  </Tab>
                  <Tab eventKey="MedicalSupplies" title="Medical Supplies">
                  <div className="InvttabsInner">
                      <div className="topInner">
                        <div className="lftinnr">
                          <div className="srchbr">
                            <Form.Control
                              type="text"
                              placeholder="Search anything"
                            />
                            <IoSearch />
                          </div>

                          <Form.Select aria-label="Default select example">
                            <option>Stock</option>
                            <option value="1">Stock One</option>
                            <option value="2">Stock Two</option>
                            <option value="3">Stock Three</option>
                          </Form.Select>
                          <Form.Select aria-label="Default select example">
                            <option>Expiry Date</option>
                            <option value="1">Expiry Date One</option>
                            <option value="2">Expiry Date Two</option>
                            <option value="3">Expiry Date Three</option>
                          </Form.Select>
                        </div>
                        <div className="Rytinnr">
                          <Form.Select aria-label="Default select example">
                            <option value="1">10</option>
                            <option value="2">20</option>
                            <option value="3">30</option>
                          </Form.Select>
                          <h6>Items</h6>
                        </div>
                      </div>
                      <ManageInvetryTable actimg1={Accpt} actimg2={Decln}/>
                    </div>
                  </Tab>
                  <Tab eventKey="PetCareProducts" title="Pet Care Products">
                  <div className="InvttabsInner">
                      <div className="topInner">
                        <div className="lftinnr">
                          <div className="srchbr">
                            <Form.Control
                              type="text"
                              placeholder="Search anything"
                            />
                            <IoSearch />
                          </div>

                          <Form.Select aria-label="Default select example">
                            <option>Stock</option>
                            <option value="1">Stock One</option>
                            <option value="2">Stock Two</option>
                            <option value="3">Stock Three</option>
                          </Form.Select>
                          <Form.Select aria-label="Default select example">
                            <option>Expiry Date</option>
                            <option value="1">Expiry Date One</option>
                            <option value="2">Expiry Date Two</option>
                            <option value="3">Expiry Date Three</option>
                          </Form.Select>
                        </div>
                        <div className="Rytinnr">
                          <Form.Select aria-label="Default select example">
                            <option value="1">10</option>
                            <option value="2">20</option>
                            <option value="3">30</option>
                          </Form.Select>
                          <h6>Items</h6>
                        </div>
                      </div>
                      <ManageInvetryTable actimg1={Accpt} actimg2={Decln}/>
                    </div>
                  </Tab>
                  <Tab eventKey="Diagnostics" title="Diagnostics">
                  <div className="InvttabsInner">
                      <div className="topInner">
                        <div className="lftinnr">
                          <div className="srchbr">
                            <Form.Control
                              type="text"
                              placeholder="Search anything"
                            />
                            <IoSearch />
                          </div>

                          <Form.Select aria-label="Default select example">
                            <option>Stock</option>
                            <option value="1">Stock One</option>
                            <option value="2">Stock Two</option>
                            <option value="3">Stock Three</option>
                          </Form.Select>
                          <Form.Select aria-label="Default select example">
                            <option>Expiry Date</option>
                            <option value="1">Expiry Date One</option>
                            <option value="2">Expiry Date Two</option>
                            <option value="3">Expiry Date Three</option>
                          </Form.Select>
                        </div>
                        <div className="Rytinnr">
                          <Form.Select aria-label="Default select example">
                            <option value="1">10</option>
                            <option value="2">20</option>
                            <option value="3">30</option>
                          </Form.Select>
                          <h6>Items</h6>
                        </div>
                      </div>
                      <ManageInvetryTable actimg1={Accpt} actimg2={Decln}/>
                    </div>
                  </Tab>
                  <Tab eventKey="Equipments" title="Equipments">
                  <div className="InvttabsInner">
                      <div className="topInner">
                        <div className="lftinnr">
                          <div className="srchbr">
                            <Form.Control
                              type="text"
                              placeholder="Search anything"
                            />
                            <IoSearch />
                          </div>

                          <Form.Select aria-label="Default select example">
                            <option>Stock</option>
                            <option value="1">Stock One</option>
                            <option value="2">Stock Two</option>
                            <option value="3">Stock Three</option>
                          </Form.Select>
                          <Form.Select aria-label="Default select example">
                            <option>Expiry Date</option>
                            <option value="1">Expiry Date One</option>
                            <option value="2">Expiry Date Two</option>
                            <option value="3">Expiry Date Three</option>
                          </Form.Select>
                        </div>
                        <div className="Rytinnr">
                          <Form.Select aria-label="Default select example">
                            <option value="1">10</option>
                            <option value="2">20</option>
                            <option value="3">30</option>
                          </Form.Select>
                          <h6>Items</h6>
                        </div>
                      </div>
                      <ManageInvetryTable actimg1={Accpt} actimg2={Decln}/>
                    </div>
                  </Tab>
                  <Tab
                    eventKey="DiagnosticSupplies"
                    title="Diagnostic Supplies"
                  >
                    <div className="InvttabsInner">
                      <div className="topInner">
                        <div className="lftinnr">
                          <div className="srchbr">
                            <Form.Control
                              type="text"
                              placeholder="Search anything"
                            />
                            <IoSearch />
                          </div>

                          <Form.Select aria-label="Default select example">
                            <option>Stock</option>
                            <option value="1">Stock One</option>
                            <option value="2">Stock Two</option>
                            <option value="3">Stock Three</option>
                          </Form.Select>
                          <Form.Select aria-label="Default select example">
                            <option>Expiry Date</option>
                            <option value="1">Expiry Date One</option>
                            <option value="2">Expiry Date Two</option>
                            <option value="3">Expiry Date Three</option>
                          </Form.Select>
                        </div>
                        <div className="Rytinnr">
                          <Form.Select aria-label="Default select example">
                            <option value="1">10</option>
                            <option value="2">20</option>
                            <option value="3">30</option>
                          </Form.Select>
                          <h6>Items</h6>
                        </div>
                      </div>
                      <ManageInvetryTable actimg1={Accpt} actimg2={Decln}/>
                    </div>
                  </Tab>
                  <Tab eventKey="Office Supplies" title="Office Supplies">
                  <div className="InvttabsInner">
                      <div className="topInner">
                        <div className="lftinnr">
                          <div className="srchbr">
                            <Form.Control
                              type="text"
                              placeholder="Search anything"
                            />
                            <IoSearch />
                          </div>

                          <Form.Select aria-label="Default select example">
                            <option>Stock</option>
                            <option value="1">Stock One</option>
                            <option value="2">Stock Two</option>
                            <option value="3">Stock Three</option>
                          </Form.Select>
                          <Form.Select aria-label="Default select example">
                            <option>Expiry Date</option>
                            <option value="1">Expiry Date One</option>
                            <option value="2">Expiry Date Two</option>
                            <option value="3">Expiry Date Three</option>
                          </Form.Select>
                        </div>
                        <div className="Rytinnr">
                          <Form.Select aria-label="Default select example">
                            <option value="1">10</option>
                            <option value="2">20</option>
                            <option value="3">30</option>
                          </Form.Select>
                          <h6>Items</h6>
                        </div>
                      </div>
                      <ManageInvetryTable actimg1={Accpt} actimg2={Decln}/>
                    </div>
                  </Tab>
                </Tabs>
              </div>

            </div>


            <div className="ProcedurePackDiv">

              <div className="ProcdpkgHead">
                <h4>Procedure Packages</h4>
                <Link to="/AddProcedurePackage"> <AiFillPlusCircle /> Create New </Link>
              </div>

              <div className="Prof">
                <ProcedureTable actimg1={Accpt} actimg2={Decln}/>
              </div>



            </div>




          </div>
        </Container>
      </section>

  );
}

export default Inventory;
