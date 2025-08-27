"use client";
import React, { useState, useEffect, useCallback } from "react";
import "./BusinessDashboard.css";
import { Button, Col, Container, Row } from "react-bootstrap";
import StatCard from "@/app/Components/StatCard/StatCard";
import { GraphSelected } from "../AdminDashboardEmpty/AdminDashboardEmpty";
import DepartmentBarChart from "@/app/Components/BarGraph/DepartmentBarChart";
import { DepartmentData } from "@/app/types";
import { IoIosAddCircleOutline, IoMdEye } from "react-icons/io";
import Link from "next/link";
import { IoNotifications } from "react-icons/io5";
import AppointmentGraph from "@/app/Components/BarGraph/AppointmentGraph";
import CommonTabs from "@/app/Components/CommonTabs/CommonTabs";

import ScheduleTable from "@/app/Components/DataTable/ScheduleTable";
import ChartCard from "@/app/Components/BarGraph/ChartCard";
import PracticeTeamTable from "@/app/Components/DataTable/PracticeTeamTable";
import InventoryTable from "@/app/Components/DataTable/InventoryTable";
import { getData } from "@/app/axios-services/services";
import { useAuthStore } from "@/app/stores/authStore";
import {

  convertFhirAppointmentBundle,
  convertFhirBundleToInventory,
  convertFHIRToGraphData,
  convertFhirToJson,
  FHIRtoJSONSpeacilityStats,
} from "@yosemite-crew/fhir";
import { Icon } from "@iconify/react/dist/iconify.js";

function BusinessDashboard() {
  const [selectedRange, setSelectedRange] = useState("Last 30 Days"); // graphSelected
  const [appointmentsData, setAppointmentsData] = useState([]);
  const [practiceTeamData, setPracticeTeamData] = useState([]);
  const [assessmentData, setAccessmentData] = useState([]);
  const [inventoryData, setInventoryData] = useState([]);
  const [inventoryCategory, setInventoryCategory] = useState([]);
  const [appointmentFilter, setAppointmentFilter] = useState("Confirmed");
  const [practiceFilter, setPracticeFilter] = useState("Cardiology");
  const [inventoryFilter, setInventoryFilter] = useState("Pharmaceuticals");
  const [inventoryandAssessmentGraph, setInventoryandAssessmentGraph] =
    useState([]);
  const [specialityWiseAppointmentsGraph, setSpecialityWiseAppointmentsGraph] =
    useState([]);
  // departmentStats Started

  const [data, setData] = useState<DepartmentData[]>([]);
  const userId = useAuthStore((state: any) => state.userId);
  useEffect(() => {
    fetchDashBoardDetails("AppointmentLists");
  }, [appointmentFilter]);
  // useEffect(() => {
  //   fetchDashBoardDetails("")
  // }, [practiceFilter]);
  useEffect(() => {
    fetchInventoryDetails("");
  }, [inventoryFilter]);
  useEffect(() => {
    getInventoryCategory();
  }, []);
  useEffect(() => {
    getAppointmentGraph();
  }, []);
  useEffect(() => {
    getSpecialityWiseAppointment();
  }, []);

  const departmentStats = [
    { name: "Oncology", value: 250 },
    { name: "Cardiology", value: 167 },
    { name: "Internal Medicine", value: 118 },
    { name: "Gastroenterology", value: 74 },
    { name: "Orthopaedics", value: 348 },
  ];
  // departmentStats Ended

  const scheduleTabs = [
    {
      eventKey: "Appointments",
      title: "Appointments",
      content: (
        <>
          <ScheduleTable data={appointmentsData} />
        </>
      ),
    },
    {
      eventKey: "Assessments",
      title: "Assessments",
      content: (
        <>
          <ScheduleTable data={assessmentData} />
        </>
      ),
    },
  ];

  const practiceTabs = [
    {
      eventKey: "Cardiology",
      title: "Cardiology",
      content: (
        <>
          <PracticeTeamTable />
        </>
      ),
    },
    {
      eventKey: "Dermatology",
      title: "Dermatology",
      content: (
        <>
          <PracticeTeamTable />
        </>
      ),
    },
    {
      eventKey: "Emergency and Critical Care",
      title: "Emergency and Critical Care",
      content: (
        <>
          <PracticeTeamTable />
        </>
      ),
    },
    {
      eventKey: "Dentistry",
      title: "Dentistry",
      content: (
        <>
          <PracticeTeamTable />
        </>
      ),
    },
    {
      eventKey: "Marketing",
      title: "Marketing",
      content: (
        <>
          <PracticeTeamTable />
        </>
      ),
    },
  ];

  const inventoryTabs = inventoryCategory.map((cat: any) => ({
    eventKey: cat._id, // use ObjectId as eventKey
    title: cat.category,
    content: (
      <InventoryTable
        categoryId={cat._id}
        data={inventoryData} // Filtered by category, ideally
      />
    ),
  }));

  const fetchDashBoardDetails = async (type: any) => {
    try {
      const response = await getData("/fhir/v1/Appointment", {
        caseType: type,
        organization: userId,
      });

      if (!response) {
        throw new Error("Network response was not ok");
      }
      const data: any = await response.data;
      // console.log(data, "DATAAAAAAAAAAAAAAAA");
      const convertToJson: any = await convertFhirAppointmentBundle(
        data.data.entry
      );
      console.log(convertToJson, "convertToJson");
      setAppointmentsData(convertToJson);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    }
  };
const fetchInventoryDetails = async (searchCategory: any) => {
  // console.log(searchCategory, "searchCategory");
  try {
    if (!userId) {
      throw new Error("userId is required");
    }

    const queryParams = new URLSearchParams({
      userId,
      searchCategory,
    });

    const response = await getData(
      `/api/inventory/InventoryItem?${queryParams.toString()}`
    );

    if (!response) {
      throw new Error("Network response was not ok");
    }

    const data: any = await response.data;
    console.log(data, "databackend");

    const convertToJson: any = convertFhirBundleToInventory(data);
    console.log(convertToJson, "Converted Inventory JSON");

    setInventoryData(convertToJson.data);
  } catch (error) {
    console.error("Error fetching inventory data:", error);
  }
};

  const getInventoryCategory = useCallback(async () => {
    try {
      const response: any = await getData(
        `fhir/admin/GetAddInventoryCategory?bussinessId=${userId}&type=category`
      );
      if (response.status === 200) {
        const res: any = convertFhirToJson(response?.data);
        setInventoryCategory(res);
      }
    } catch (error) {
      console.error(error);
    }
  }, [userId]);
  const getSpecialityWiseAppointment = useCallback(async () => {
    try {
      const response: any = await getData(
        `fhir/v1/List?reportType=specialityWiseAppointments&userId=${userId}&LastDays=${6}`
      );
      if (response.status === 200) {
        // const res:any = response?.data
        const res: any = FHIRtoJSONSpeacilityStats(response?.data);
        console.log(res, "FHIRtoJSONSpeacilityStats");
        setSpecialityWiseAppointmentsGraph(res);
      }
    } catch (error) {
      console.error(error);
    }
  }, [userId]);

  const getAppointmentGraph = useCallback(async () => {
    try {
      const response: any = await getData(
        `fhir/v1/AppointmentGraphOnMonthBase?userId=${userId}&days=${3}`
      );
      if (response.status === 200) {
        // const res:any = response?.data
        const res: any = convertFHIRToGraphData(response?.data?.data);
        console.log(res, "ResOfMOnth");
        setInventoryandAssessmentGraph(res);
      }
    } catch (error) {
      console.error(error);
    }
  }, [userId]);

  console.log(
    inventoryCategory,
    "inventoryCategory"
  );
  return (
    <>
      <section className="BusinessDashboardSec">
        <Container>
          <div className="BusinessDashboardData">
            <div className="BuisnessDashTop">
              <div className="TopDashHead">
                <div className="leftwlmdiv">
                  <span>Welcome</span>
                  <div className="wlcdash">
                    <h2>Your Dashboard</h2>
                    <div className="Apoitpopup">
                      <IoNotifications /> 8 New Appointments
                    </div>
                  </div>
                </div>
                <div className="Ryttwlmdiv">
                  <div className="ClinicVisibleBtn">
                    <Link href="">
                      <IoMdEye /> Manage Clinic Visibility
                    </Link>
                  </div>
                  <div className="invitbtn">
                    <Link href="/practiceTeam">
                      <IoIosAddCircleOutline /> Invite Practice Member
                    </Link>
                  </div>
                </div>
              </div>
              <Row>
                <Col md={3}>
                  <StatCard
                    icon="solar:wallet-2-bold"
                    title="Revenue (Today)"
                    value={158}
                  />
                </Col>
                <Col md={3}>
                  <StatCard
                    icon="solar:calendar-mark-bold"
                    title="Appointments (Today)"
                    value={122}
                  />
                </Col>
                <Col md={3}>
                  <StatCard
                    icon="solar:medical-kit-bold"
                    title="Staff on-duty"
                    value={45}
                  />
                </Col>
                <Col md={3}>
                  <StatCard
                    icon="solar:home-add-bold"
                    title="Inventory Out-of-Stock"
                    value="$7,298"
                  />
                </Col>
              </Row>
            </div>

            <Row>
              <Col md={6}>
                <GraphSelected
                  title="Appointments & Assessments"
                  options={["Last 3 Months", "Last 6 Months", "Last 1 Year"]}
                  selectedOption={selectedRange}
                  onSelect={setSelectedRange}
                />

                <AppointmentGraph data={inventoryandAssessmentGraph} />
              </Col>
              <Col md={6}>
                <GraphSelected
                  title="Revenue"
                  options={["Last 30 Days", "Last 6 Months", "Last 1 Year"]}
                  selectedOption={selectedRange}
                  onSelect={setSelectedRange}
                />

                <ChartCard />
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <GraphSelected
                  title="Speciality-wise appointments"
                  options={["Last 3 Months", "Last 6 Months", "Last 1 Year"]}
                  selectedOption={selectedRange}
                  onSelect={setSelectedRange}
                />
                <DepartmentBarChart
                  data={
                    data.length > 0 ? data : specialityWiseAppointmentsGraph
                  }
                />
              </Col>
              <Col md={6}>
                <GraphSelected
                  title="Department-wise Income"
                  options={["Last 30 Days", "Last 6 Months", "Last 1 Year"]}
                  selectedOption={selectedRange}
                  onSelect={setSelectedRange}
                />
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
              </Col>
            </Row>

            <Row>
              <div className="TableItemsRow">
                <HeadingDiv Headname="Today’s Schedule" Headspan="95" />
                <CommonTabs onTabClick={fetchInventoryDetails} tabs={scheduleTabs} showStatusSelect />
              </div>
            </Row>

            <Row>
              <div className="TableItemsRow">
                <HeadingDiv Headname="Practice Team" Headspan="74" />
                <CommonTabs onTabClick={fetchInventoryDetails} tabs={practiceTabs} showStatusSelect />
              </div>
            </Row>

            <Row>
              <div className="TableItemsRow">
                <HeadingDiv Headname="Inventory" />
                <CommonTabs
                  headname="Inventory"
                  tabs={inventoryTabs}
                  onTabClick={fetchInventoryDetails}
                  showStatusSelect
                />
              </div>
            </Row>
          </div>
        </Container>
      </section>
    </>
  );
}

export default BusinessDashboard;

// HeadingDivProps Started
interface HeadingDivProps {
  Headname?: string;
  btntext?: string;
  href?: string; // ✅ optional now
  icon?: string;
  Headspan?: string | number;
}

export function HeadingDiv({ Headname, Headspan, btntext, icon, href }: HeadingDivProps) {
  return (
    <div className="DivHeading">
      <h5>
        {Headname}
        {Headspan !== undefined && <span>({Headspan})</span>}
      </h5>
      {btntext && href && (
        <Link href={href}>
          {icon && <Icon icon={icon} width="20" height="20" />}
          {btntext}
        </Link>
      )}
    </div>
  );
}


// HeadingDivProps Ended
