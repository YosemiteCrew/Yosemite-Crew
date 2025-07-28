'use client';
import React, { useState , useEffect, useCallback } from 'react';
import "./InventoryDashboard.css"
import { Col, Container, Row } from 'react-bootstrap'
import { HeadText } from '../CompleteProfile/CompleteProfile'
import StatCard from '@/app/Components/StatCard/StatCard'
import { OverviewDisp } from '../Departments/DepartmentsDashboard'
import { GraphSelected } from '../AdminDashboardEmpty/AdminDashboardEmpty';
import DepartmentBarChart from '@/app/Components/BarGraph/DepartmentBarChart';
import ApprochExpireGraph from '@/app/Components/BarGraph/ApprochExpireGraph';
import { DepartmentData } from '@/app/types';
import CommonTabs from '@/app/Components/CommonTabs/CommonTabs';
import ManageInventoryTable from '@/app/Components/DataTable/ManageInventoryTable';
import ProcedurePackagesTable from '@/app/Components/DataTable/ProcedurePackagesTable';
import { getData } from '@/app/axios-services/services';
import { convertFhirBundleToInventory, convertFhirToJson } from '@yosemite-crew/fhir';
import { useAuthStore } from '@/app/stores/authStore';

function InventoryDashboard() {
    const { userId } = useAuthStore();
    const [selectedDoctor, setSelectedDoctor] = useState("Last 30 Days");
    const [selectedRange, setSelectedRange] = useState("Last 3 Months");// graphSelected 
    const [inventoryCategory, setInventoryCategory] = useState<any[]>([]);
    const [inventoryData, setInventoryData] = useState<any[]>([]);

     // departmentStats Started 
        
        const [data, setData] = useState<DepartmentData[]>([]);
        useEffect(() => {
        fetch('/api/departments')
            .then(res => res.json())
            .then(json => setData(json));
        }, []);

        const departmentStats = [
        { name: 'Oncology', value: 250 },
        { name: 'Cardiology', value: 167 },
        { name: 'Internal Medicine', value: 118 },
        { name: 'Gastroenterology', value: 74 },
        { name: 'Orthopaedics', value: 348 },
        ];
    // departmentStats Ended

    const approachingExpiryData = [
        { name: '<7 Days', value: 145 },
        { name: '<15 Days', value: 180 },
        { name: '<30 Days', value: 90 },
        { name: '<60 Days', value: 60 },
    ];



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

 useEffect(() => {
   if (userId) {
     getInventoryCategory();
   }
  }, [getInventoryCategory, userId]);


const fetchInventoryDetails = async (searchCategory: any) => {
    console.log(searchCategory, "searchCategory");
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
      // console.log(data, "FHIR Inventory Data");

      const convertToJson: any = convertFhirBundleToInventory(data);
      console.log(convertToJson, "Converted Inventory JSON");

      setInventoryData(convertToJson.data);
    } catch (error) {
      console.error("Error fetching inventory data:", error);
    }
  };



    // const manageinvtTabs = [
    //     {
    //     eventKey: 'Appointments',
    //     title: 'Appointments',
    //     content: (
    //         <>
    //             <ManageInventoryTable/>
    //         </>
    //     ),
    //     },
    //     {
    //     eventKey: 'Assessments',
    //     title: 'Assessments',
    //     content: (
    //         <>
    //             <ManageInventoryTable/>
    //         </>
    //     ),
    //     }
    // ];
const inventoryTabs = inventoryCategory.map((cat: any) => ({
    eventKey: cat._id, // use ObjectId as eventKey
    title: cat.category,
    content: (
      <ManageInventoryTable
        categoryId={cat._id}
        data={inventoryData} // Filtered by category, ideally
      />
    ),
  }));
  return (
    <>

    <section className='InventoryDashboardSec'>
        <Container>
            <div className="InventoryDashboardData">
                <div className="inventoryTopBar">
                    <HeadText blktext="Inventory" Spntext="Overview" />
                    <div className="inventryoverview">
                        <OverviewDisp hideTitle={true} showDropdown={true} selectedDoctor={selectedDoctor} setSelectedDoctor={setSelectedDoctor}/>
                        <Row>
                            <Col md={3}><StatCard icon="/Images/stact1.png" title="Appointments (Today)" value={158} /></Col>
                            <Col md={3}><StatCard icon="/Images/stact2.png" title="Staff on-duty" value={122} /></Col>
                            <Col md={3}><StatCard icon="/Images/stact3.png" title="Inventory Out-of-Stock" value={45} /></Col>
                            <Col md={3}><StatCard icon="/Images/stact4.png" title="Revenue (Today)" value="$7,298" /></Col>
                        </Row>
                    </div>
                    <Row>
                        <Col md={6}>
                            <div className="graphinvetry">
                                <OverviewDisp hideTitle={false} titleText="Approaching Expiry" showDropdown={false} />
                                <ApprochExpireGraph chartData={approachingExpiryData} />
                            </div>
                        </Col>

                        <Col md={6}>

                            <GraphSelected
                                title="Category Breakdown"
                                options={["Last 3 Months", "Last 6 Months", "Last 1 Year"]}
                                selectedOption={selectedRange}
                                onSelect={setSelectedRange}/>
                                <DepartmentBarChart data={data.length > 0 ? data : departmentStats} />

                        </Col>
                    </Row>
                </div>
                <div className="MangeInventryData">
                    <HeadText blktext="Manage" Spntext="Inventory" />
                   <CommonTabs
                headname="Inventory"
                  tabs={inventoryTabs}
                  onTabClick={fetchInventoryDetails}
                  showStatusSelect
                />
                    <div className="ProcedurePackage">
                        <h4>Procedure Packages</h4>
                        <ProcedurePackagesTable/>
                    </div>
                </div>
            </div>
        </Container>
    </section>
    </>
  )
}

export default InventoryDashboard