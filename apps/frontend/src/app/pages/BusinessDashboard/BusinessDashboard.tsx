"use client";
import React, { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { Col, Container, Row } from "react-bootstrap";
import { IoIosAddCircleOutline, IoMdEye } from "react-icons/io";
import { IoNotifications } from "react-icons/io5";
import {
  convertFhirBundleToInventory,
  convertFHIRToAdminDepartments,
  convertFHIRToGraphData,
  FHIRtoJSONSpeacilityStats,
} from "@yosemite-crew/fhir";
import { Icon } from "@iconify/react/dist/iconify.js";

import StatCard from "@/app/components/StatCard/StatCard";
import DepartmentBarChart from "@/app/components/BarGraph/DepartmentBarChart";
import AppointmentGraph from "@/app/components/BarGraph/AppointmentGraph";
import CommonTabs from "@/app/components/CommonTabs/CommonTabs";
import BusinessdashBoardTable from "@/app/components/DataTable/BusinessdashBoardTable";
import ChartCard from "@/app/components/BarGraph/ChartCard";
import InventoryTable from "@/app/components/DataTable/InventoryTable";
import { GraphSelected } from "@/app/pages/AdminDashboardEmpty/AdminDashboardEmpty";
import { getData } from "@/app/services/axios";
import { useOldAuthStore } from "@/app/stores/oldAuthStore";
import CommonTabForBusinessDashboard from "@/app/components/CommonTabs/CommonTabForBusinessDashboard";
import CommonTabForPractitioners from "@/app/components/CommonTabs/CommonTabForPractitioners";

import "./BusinessDashboard.css";

type AppointmentStatus =
  | "In-Progress"
  | "Checked-In"
  | "Pending"
  | "accepted"
  | "cancelled"
  | "fulfilled";

interface DepartmentData {
  name: string;
  value: number;
}

export type TodayAppointmentItem = {
  id: string;
  name: string;
  owner: string;
  image: string;
  tokenNumber: string;
  reason: string;
  petType: string;
  pet?: string;
  time: string;
  date: string;
  doctorName: string;
  specialization: string;
  status: AppointmentStatus;
};

const BusinessDashboard = () => {
  const [selectedRange, setSelectedRange] = useState("Last 30 Days");
  const [specialityWiseSelectedRange, setSpecialityWiseSelectedRange] =
    useState("Last 3 Months");
  const [revenueSelectedRange, setRevenueSelectedRange] =
    useState("Last 30 Days");
  const [inventoryData, setInventoryData] = useState([]);
  const [inventoryCategory, setInventoryCategory] = useState([]);
  const [appointmentFilter, setAppointmentFilter] = useState("accepted");
  const [inventoryandAssessmentGraph, setInventoryandAssessmentGraph] =
    useState([]);
  const [specialityWiseAppointmentsGraph, setSpecialityWiseAppointmentsGraph] =
    useState([]);
  const [data] = useState<DepartmentData[]>([]);
  const [departments, setDepartments] = useState([{ eventKey: "", title: "" }]);
  const userId = useOldAuthStore((state: any) => state.userId);

  const fetchInventoryDetails = useCallback(
    async (searchCategory: string = "") => {
      try {
        if (!userId) {
          throw new Error("userId is required");
        }
        const queryParams = new URLSearchParams({ userId, searchCategory });
        const response = await getData(
          `/api/inventory/InventoryItem?${queryParams.toString()}`
        );
        if (!response) {
          throw new Error("Network response was not ok");
        }
        console.log(response, "Converted Inventory JSON");
        const data: any = await response.data;
        const convertToJson: any = convertFhirBundleToInventory(data);
        setInventoryData(convertToJson.data);
      } catch (error) {
        console.error("Error fetching inventory data:", error);
      }
    },
    [userId]
  );

  const getInventoryCategory = useCallback(async () => {
    try {
      const response: any = await getData(
        `fhir/admin/GetAddInventoryCategory?bussinessId=${userId}&type=category`
      );
      if (response.status === 200) {
        setInventoryCategory([]);
      }
    } catch (error) {
      console.error(error);
    }
  }, [userId]);

  const fetchDepartments = useCallback(async () => {
    try {
      const response: any = await getData(
        `api/auth/getDepartmentsOfBusiness?userId=${userId}`
      );
      if (response.status === 200) {
        const res: any = response?.data;
        setDepartments(
          convertFHIRToAdminDepartments(res.data).map((item: any) => ({
            eventKey: item._id,
            title: item.name,
          }))
        );
      }
    } catch (error) {
      console.error(error);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchDepartments();
    }
  }, [userId, fetchDepartments]);

  const getSpecialityWiseAppointment = useCallback(
    async (Months: string) => {
      const match = /\d+/.exec(Months);
      const days = parseInt(match?.[0] || "3", 10);
      try {
        const response: any = await getData(
          `fhir/v1/List?reportType=specialityWiseAppointments&userId=${userId}&LastDays=${days}`
        );
        if (response.status === 200) {
          const res: any = FHIRtoJSONSpeacilityStats(response?.data);
          setSpecialityWiseAppointmentsGraph(res);
        }
      } catch (error) {
        console.error(error);
      }
    },
    [userId]
  );

  const getAppointmentGraph = useCallback(async () => {
    try {
      const response: any = await getData(
        `fhir/v1/AppointmentGraphOnMonthBase?userId=${userId}&days=${3}`
      );
      if (response.status === 200) {
        console.log("Appointment Graph Response:", response);
        const res: any = convertFHIRToGraphData(response?.data?.data);
        setInventoryandAssessmentGraph(res);
      }
    } catch (error) {
      console.error(error);
    }
  }, [userId]);

  const getAssessments = useCallback(async () => {
    try {
      await getData(`/api/assessments/getAssessments?userId=${userId}`);
    } catch (error) {
      console.error("Error fetching assessments:", error);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchInventoryDetails("");
      getInventoryCategory();
      getAppointmentGraph();
    }
  }, [
    userId,
    fetchInventoryDetails,
    getInventoryCategory,
    getAppointmentGraph,
    getSpecialityWiseAppointment,
  ]);

  useEffect(() => {
    if (userId) {
      getSpecialityWiseAppointment(specialityWiseSelectedRange);
    }
  }, [userId, specialityWiseSelectedRange, getSpecialityWiseAppointment]);

  const handleScheduleTabClick = useCallback(
    (eventKey?: string, status?: string) => {
      if (status) {
        setAppointmentFilter(status);
      }
      if (eventKey === "Assessments") {
        getAssessments();
      }
    },
    [getAssessments]
  );

  const scheduleTabs = [
    {
      eventKey: "Appointments",
      title: "Appointments",
      content: <BusinessdashBoardTable status={appointmentFilter} />,
    },
    // {
    //   eventKey: "Assessments",
    //   title: "Assessments",
    //   content: <ScheduleTable data={assessmentData} />,
    // },
  ];

  const inventoryTabs = inventoryCategory?.map((cat: any) => ({
    eventKey: cat._id,
    title: cat.category,
    content: <InventoryTable categoryId={cat._id} data={inventoryData} />,
  }));

  return (
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
                selectedOption={revenueSelectedRange}
                onSelect={setRevenueSelectedRange}
              />
              <ChartCard />
            </Col>
          </Row>

          <Row>
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
            <Col md={6}>
              <GraphSelected
                title="Speciality-wise appointments"
                options={["Last 1 Month", "Last 3 Months", "Last 6 Months"]}
                selectedOption={specialityWiseSelectedRange}
                onSelect={setSpecialityWiseSelectedRange}
              />
              <DepartmentBarChart
                data={data.length > 0 ? data : specialityWiseAppointmentsGraph}
              />
            </Col>
          </Row>

          <Row>
            <div className="TableItemsRow">
              <HeadingDiv Headname="Today’s Schedule" />
              <CommonTabForBusinessDashboard
                onTabClick={handleScheduleTabClick}
                tabs={scheduleTabs}
                showStatusSelect
              />
            </div>
          </Row>
          <Row>
            <div className="TableItemsRow">
              <HeadingDiv Headname="Practice Team" Headspan="74" />
              <CommonTabForPractitioners
                tabs={departments}
                showStatusSelect
                headname="Practice Team"
                defaultActiveKey={departments[0]?.eventKey}
              />
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
  );
};

export default BusinessDashboard;

// HeadingDivProps
interface HeadingDivProps {
  Headname?: string;
  btntext?: string;
  href?: string;
  icon?: string;
  Headspan?: string | number;
}

const HeadingDiv = ({
  Headname,
  Headspan,
  btntext,
  icon,
  href,
}: Readonly<HeadingDivProps>) => {
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
};

export { HeadingDiv };
