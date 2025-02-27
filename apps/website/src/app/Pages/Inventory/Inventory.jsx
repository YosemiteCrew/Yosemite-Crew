import React, { useEffect, useState } from 'react';
import './Inventory.css';
import { Container, Form, Tab, Tabs } from 'react-bootstrap';
import { BoxDiv, ListSelect } from '../Dashboard/page';
import box9 from '../../../../public/Images/box9.png';
import box10 from '../../../../public/Images/box10.png';
import box11 from '../../../../public/Images/box11.png';
import box12 from '../../../../public/Images/box12.png';
import WeeklyAppointmentsChart from '../../Components/BarGraph/WeeklyAppointmentsChart';
import DepartmentAppointmentsChart from '../../Components/BarGraph/DepartmentAppointmentsChart';
import { AiFillPlusCircle } from 'react-icons/ai';
import { IoSearch } from 'react-icons/io5';
import { Link } from 'react-router-dom';
import ProcedureTable from '../../Components/ProcedureTable/ProcedureTable';
import Accpt from '../../../../public/Images/view.png';
import Decln from '../../../../public/Images/delete.png';
import ManageInvetryTable from '../../Components/ManageInvetryTable/ManageInvetryTable';
import axios from 'axios';
import { useAuth } from '../../context/useAuth';
import DynamicDatePicker from '../../Components/DynamicDatePicker/DynamicDatePicker';
import Swal from 'sweetalert2';

const INVENTORY_TABS = [
  'Pharmaceuticals',
  'Medical Supplies',
  'Pet Care Products',
  'Diagnostics',
  'Equipments',
  'Diagnostic Supplies',
  'Office Supplies',
];

function Inventory() {
  const { userId } = useAuth();
  const [date, setDate] = useState('');
  const [inventoryData, setInventoryData] = useState([]);
  const [procedureData, setProcedureData] = useState([]);

  const [category, setCategory] = useState(INVENTORY_TABS[0]);
  const [searchItem, setSearchItem] = useState('');
  // const [stock, setStock] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [totalPages, setTotalPages] = useState(1);
  const [procedureTotalPages, setProcedureTotalPages] = useState(1);
  const [procedureCurrentPage, setProcedureCurrentPage] = useState(1);
  console.log('procedureData', procedureData, procedureTotalPages);

  useEffect(() => {
    const getInventory = async () => {
      try {
        const response = await axios.get(
          `${process.env.NX_PUBLIC_VITE_BASE_URL}api/inventory/getInventory`,
          {
            params: {
              userId,
              searchItem,
              expiryDate: date,

              category,
              skip: (currentPage - 1) * itemsPerPage,
              limit: itemsPerPage,
            },
          }
        );
        setInventoryData(response.data.inventory);
        setTotalPages(response.data.totalPages); // Ensure API returns totalCount
      } catch (error) {
        console.error('Error fetching inventory:', error);
      }
    };

    if (userId) getInventory();
  }, [userId, searchItem, date, currentPage, category]);

  const handleDateChange = (selectedDate) => setDate(selectedDate);
  const handleSearch = (e) => setSearchItem(e.target.value);
  // const handleStock = (e) => setSearchItem(e.target.value);
  const handleCategory = (tab) => setCategory(tab);
  // const handleNextPage = () => setCurrentPage((prev) => prev + 1);
  // const handlePrevPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1));
  const getProcedureData = async () => {
    try {
      const response = await axios.get(
        `${process.env.NX_PUBLIC_VITE_BASE_URL}api/inventory/getProceurePackage`,
        {
          params: {
            userId,
            skip: (procedureCurrentPage - 1) * itemsPerPage,
            limit: itemsPerPage,
          },
        }
      );
      if (response.status === 200) {
        setProcedureData(response.data.procedurePackage[0]);
        setProcedureTotalPages(response.data.procedurePackage[0].totalPages);
      } else {
        console.log('error');
      }
    } catch (error) {
      console.error('Error fetching inventory:', error);
    }
  };
  useEffect(() => {
    
    if (userId) getProcedureData();
  }, [userId,procedureCurrentPage]);

  const handleDeleteItem = async (id) => {
    Swal.fire({
      title: 'Are you sure you want to delete this item?',
      text: "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, delete it!',
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const response = await axios.delete(
            `${process.env.NX_PUBLIC_VITE_BASE_URL}api/inventory/deleteProcedurePackage`,
            {
              params: {
                userId,
                id,
              },
            }
          );
  console.log(response);
          if (response.status===200) {
            Swal.fire({
              title: 'Deleted!',
              text: 'Item has been deleted successfully.',
              icon: 'success',
            });
            getProcedureData() // Refresh data after deletion
          } else {
            Swal.fire({
              title: 'Error',
              text: 'Failed to delete the item.',
              icon: 'error',
            });
          }
        } catch (error) {
          console.error('Error deleting item:', error);
          Swal.fire({
            title: 'Error',
            text: 'Something went wrong. Please try again!',
            icon: 'error',
          });
        }
      }
    });
  };
  
  return (
    <section className="InventorySec">
      <Container>
        <div className="InventoryData">
          <div className="InvetHead">
            <h2>
              <span>Inventory</span> Overview
            </h2>
          </div>

          <div className="overviewDiv">
            <div className="OverviewTop">
              <ListSelect
                options={[
                  'Last 7 Days',
                  'Last 10 Days',
                  'Last 20 Days',
                  'Last 21 Days',
                ]}
              />
            </div>
            <div className="overviewitem">
              <BoxDiv
                boximg={box9}
                ovradcls="purple"
                ovrtxt="Total Inventory Items"
                boxcoltext="purpletext"
                overnumb="5,250"
              />
              <BoxDiv
                boximg={box10}
                ovradcls="cambrageblue"
                ovrtxt="Stock Value"
                boxcoltext="greentext"
                overnumb="$15,089"
              />
              <BoxDiv
                boximg={box11}
                ovradcls="fawndark"
                ovrtxt="Items Low on Stock"
                boxcoltext="frowntext"
                overnumb="320"
              />
              <BoxDiv
                boximg={box12}
                ovradcls="chillibg"
                ovrtxt="Out-of-Stock Items"
                boxcoltext="ciltext"
                overnumb="45"
              />
            </div>
          </div>

          <div className="InventoryGrph">
            <div className="Inventrygrphdiv">
              <h6>Approaching Expiry</h6>
              <WeeklyAppointmentsChart />
            </div>
            <div className="Inventrygrphdiv">
              <h6>Category Breakdown</h6>
              <ListSelect
                options={[
                  'Last 3 Months',
                  'Last 6 Months',
                  'Last 9 Months',
                  'Last 12 Months',
                ]}
              />
              <DepartmentAppointmentsChart />
            </div>
          </div>

          <div className="ManageInvtDiv">
            <div className="ManageHead">
              <h2>
                <span>Manage</span> Inventory
              </h2>
              <Link to="/AddInventory">
                <AiFillPlusCircle /> Add Inventory
              </Link>
            </div>

            <div className="ManageInvtTabs">
              <Tabs
                defaultActiveKey={INVENTORY_TABS[0]}
                onSelect={handleCategory}
                id="inventory-tabs"
                className="mb-3"
              >
                {INVENTORY_TABS.map((tab) => (
                  <Tab eventKey={tab} title={tab} key={tab}>
                    <div className="InvttabsInner">
                      <div className="topInner">
                        <div className="lftinnr">
                          <div className="srchbr">
                            <Form.Control
                              type="text"
                              placeholder="Search anything"
                              onChange={handleSearch}
                            />
                            <IoSearch />
                          </div>
                          {/* <Form.Select onChange={handleStock}>
                            <option>Stock</option>
                            <option>20</option>
                            <option>30</option>
                            <option>40</option>
                          </Form.Select> */}
                          <DynamicDatePicker
                            onDateChange={handleDateChange}
                            placeholder="Expiry Date"
                            maxDate={Date.now()}
                          />
                        </div>
                      </div>
                      <ManageInvetryTable
                        actimg1={Accpt}
                        actimg2={Decln}
                        inventoryData={inventoryData}
                        currentPage={currentPage}
                        setCurrentPage={setCurrentPage}
                        totalPages={totalPages}
                        setTotalPages={setTotalPages}
                      />
                    </div>
                  </Tab>
                ))}
              </Tabs>
            </div>
          </div>
          <div className="ProcedurePackDiv">
            <div className="ProcdpkgHead">
              <h4>Procedure Packages</h4>
              <Link to="/AddProcedurePackage">
                <AiFillPlusCircle /> Create New
              </Link>
            </div>
            <div className="Prof">
              <ProcedureTable
                actimg1={Accpt}
                actimg2={Decln}
                procedureData={procedureData.data}
                procedureTotalPages={procedureTotalPages}
                setProcedureCurrentPage={setProcedureCurrentPage}
                procedureCurrentPage={procedureCurrentPage}
                setProcedureTotalPages={setProcedureTotalPages}
                handleDeleteItem={handleDeleteItem}
              />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

export default Inventory;
