import React, { useState } from 'react';
import PropTypes from 'prop-types';
import "./ClientStatement.css";
import { Container, Form } from 'react-bootstrap';
import { IoSearch } from 'react-icons/io5';
import { ListSelect } from '../Dashboard/page';
import { Link } from 'react-router-dom';
import { MdOutlinePets } from 'react-icons/md';
// import eye from "../../../../public/Images/eye.png"
// import downlode from "../../../../public/Images/downlode.png"

function ClientStatement({ Chatstatemnt = [] }) {
  // Fallback data if no props are passed
  const appointmentsActionList = [
    {
      id: '70M6VJN',
      Name: 'Sky B',
      petName: 'Kizie',
      stmnt: '3ZTABC456',
      stdate: '20 Jan 2025',
      stamount: '167.77',
      stamoutpaid: '$13.25',
      stbalance: '$2.99',
      Ststatus: 'Paid',
      paidclass: 'paid',
      acceptAction: '/chatstatementdetails',  
      declineAction: '/chatstatementdetails', 
    },
    {
      id: '1J2U23Z',
      Name: 'Pika K',
      petName: 'Oscar',
      stmnt: 'BDY024474',
      stdate: '2 Jan 2025',
      stamount: '5,728.48',
      stamoutpaid: '$42.28',
      stbalance: '23.87',
      Ststatus: 'Unpaid',
      paidclass: 'Unpaid',
      acceptAction: '#',  
      declineAction: '#', 
    },
    {
      id: 'EFF2S2G',
      Name: 'Henry C',
      petName: 'King',
      stmnt: 'BDY019136',
      stdate: '31 Dec 2024',
      stamount: '$3368.4',
      stamoutpaid: '$4.23',
      stbalance: '$5.99',
      Ststatus: 'Unpaid',
      paidclass: 'Unpaid',
      acceptAction: '#',  
      declineAction: '#', 
    },
    {
      id: '68KVBZG',
      Name: 'Danny J',
      petName: 'Joey',
      stmnt: '3ZTABC123',
      stdate: '29 Dec 2024',
      stamount: '$10,830.29',
      stamoutpaid: '89.71',
      stbalance: '$10.99',
      Ststatus: 'Partially Paid',
      paidclass: 'Partially',
      acceptAction: '#',  
      declineAction: '#', 
    },
    {
      id: 'QAY0XLB',
      Name: 'Chris T',
      petName: 'Tini',
      stmnt: '4ZTABC130',
      stdate: '28 Dec 2024',
      stamount: '$5,571.39',
      stamoutpaid: '103.98',
      stbalance: '89.71',
      Ststatus: 'Overdue',
      paidclass: 'Overdue',
      acceptAction: '#',  
      declineAction: '#', 
    },
    {
      id: '70M6VJN',
      Name: 'Sky B',
      petName: 'Kizie',
      stmnt: '3ZTABC456',
      stdate: '20 Jan 2025',
      stamount: '167.77',
      stamoutpaid: '$13.25',
      stbalance: '$2.99',
      Ststatus: 'Paid',
      paidclass: 'paid',
      acceptAction: '#',  
      declineAction: '#', 
    },
    {
      id: '1J2U23Z',
      Name: 'Pika K',
      petName: 'Oscar',
      stmnt: 'BDY024474',
      stdate: '2 Jan 2025',
      stamount: '5,728.48',
      stamoutpaid: '$42.28',
      stbalance: '23.87',
      Ststatus: 'Unpaid',
      paidclass: 'Unpaid',
      acceptAction: '#',  
      declineAction: '#', 
    },
    {
      id: 'EFF2S2G',
      Name: 'Henry C',
      petName: 'King',
      stmnt: 'BDY019136',
      stdate: '31 Dec 2024',
      stamount: '$3368.4',
      stamoutpaid: '$4.23',
      stbalance: '$5.99',
      Ststatus: 'Unpaid',
      paidclass: 'Unpaid',
      acceptAction: '#',  
      declineAction: '#', 
    },
    {
      id: '68KVBZG',
      Name: 'Danny J',
      petName: 'Joey',
      stmnt: '3ZTABC123',
      stdate: '29 Dec 2024',
      stamount: '$10,830.29',
      stamoutpaid: '89.71',
      stbalance: '$10.99',
      Ststatus: 'Partially Paid',
      paidclass: 'Partially',
      acceptAction: '#',  
      declineAction: '#', 
    },
    {
      id: 'QAY0XLB',
      Name: 'Chris T',
      petName: 'Tini',
      stmnt: '4ZTABC130',
      stdate: '28 Dec 2024',
      stamount: '$5,571.39',
      stamoutpaid: '103.98',
      stbalance: '89.71',
      Ststatus: 'Overdue',
      paidclass: 'Overdue',
      acceptAction: '#',  
      declineAction: '#', 
    },
  ];

  // Use provided `appointments` or fallback data
  const dataToRender = Chatstatemnt.length > 0 ? Chatstatemnt : appointmentsActionList;

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 5;

  // Get current page data
  const currentData = dataToRender.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  // Pagination handlers
  const handleNext = () => {
    if (currentPage < Math.ceil(dataToRender.length / itemsPerPage) - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrev = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  return (
    <section className='ChatStatementSec'>
      <Container>
        <div className="ChatPageData">
          <div className="ChatStHead">
            <h2>Client Statements</h2>
          </div>

          <div className="ChatStateDiv">

            <div className="TopChatDiv">
              <div className="lftChatState">
                <div className="srchbr">
                  <Form.Control type="text" placeholder="Search anything" />
                  <IoSearch />
                </div>
                <Form.Select aria-label="Default select example">
                  <option>Amount</option>
                  <option value="1">51515</option>
                  <option value="2">4656465</option>
                  <option value="3">5655</option>
                </Form.Select>
                <Form.Select aria-label="Default select example">
                  <option>Payment Status</option>
                  <option value="1">Paid</option>
                  <option value="2">Unpaid</option>
                  <option value="3">Partially Paid</option>
                  <option value="3">Overdue</option>
                </Form.Select>
              </div>
              <div className="RytChatState">
                <ListSelect options={["Last 7 Days", "Last 10 Days", "Last 20 Days", "Last 21 Days"]} />
              </div>
            </div>

            <div className="ChatStatemtTableDiv">
              <table className="Statemnttable">
                <thead>
                  <tr>
                    <th scope="col">Animal ID</th>
                    <th scope="col">Name</th>
                    <th scope="col">Statement #</th>
                    <th scope="col">Statement Date</th>
                    <th scope="col">Total Amount</th>
                    <th scope="col">Amount Paid</th>
                    <th scope="col">Balance</th>
                    <th scope="col">Status</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentData.map((chatstatmnt, index) => (
                    <tr key={index}>
                      <td>{chatstatmnt.id}</td>
                      <td>
                        <div className="tblDiv">
                          <h4>{chatstatmnt.Name}</h4>
                          <p><MdOutlinePets /> {chatstatmnt.petName} </p>
                        </div>
                      </td>
                      <td>{chatstatmnt.stmnt}</td>
                      <td>{chatstatmnt.stdate}</td>
                      <td>{chatstatmnt.stamount}</td> 
                      <td>{chatstatmnt.stamoutpaid}</td>
                      <td>{chatstatmnt.stbalance}</td>
                      <td className='ststatus'><span className={chatstatmnt.paidclass}>{chatstatmnt.Ststatus}</span></td>
                      <td>
                        <div className="chataction">
                          <Link href={chatstatmnt.acceptAction}> <img src={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/eye.png`} alt="eye" width={24} height={24} /></Link>
                          <Link href={chatstatmnt.declineAction}><img src={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/downlode.png`} alt="downlode" width={24} height={24} /></Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination Controls */}
              <div className="PaginationDiv">
                <button onClick={handlePrev} disabled={currentPage === 0}>
                  <i className="ri-arrow-left-line"></i>
                </button>
                <h6 className="PagiName">
                  Responses 
                  <span>
                    {currentPage * itemsPerPage + 1} - {Math.min((currentPage + 1) * itemsPerPage, dataToRender.length)}
                  </span>
                </h6>
                <button onClick={handleNext} disabled={currentPage >= Math.ceil(dataToRender.length / itemsPerPage) - 1}>
                  <i className="ri-arrow-right-line"></i>
                </button>
              </div>

            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

ClientStatement.propTypes = {
    Chatstatemnt: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      petName: PropTypes.string.isRequired,
      ownerName: PropTypes.string.isRequired,
      petType: PropTypes.string.isRequired,
      breed: PropTypes.string.isRequired,
      appointmentDate: PropTypes.string.isRequired,
      appointmentTime: PropTypes.string.isRequired,
      doctorName: PropTypes.string.isRequired,
      specialization: PropTypes.string.isRequired,
      petImage: PropTypes.string.isRequired,
      acceptAction: PropTypes.string.isRequired,
      declineAction: PropTypes.string.isRequired,
    })
  ),
};

export default ClientStatement;
