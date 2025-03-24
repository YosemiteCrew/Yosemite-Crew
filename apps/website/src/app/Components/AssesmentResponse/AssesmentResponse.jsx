
import React , { useState } from 'react';
import "./AssesmentResponse.css"


const AssesmentResponse = () => {
  // Sample data for assessment responses
  const assessmentData = [
    {
      questionNumber: '01',
      category: 'Pain Monitoring',
      question: "Rate your pet's mood and willingness to interact with you:",
      response: 'Happy',
      details: 'Alert and Interactive',
    },
    {
      questionNumber: '02',
      category: 'Pain Monitoring',
      question: 'How painful is your pet after exercise?',
      response: 'No Pain',
      details: '',
    },
    {
      questionNumber: '03',
      category: 'Pain Monitoring',
      question: 'How well does your pet sleep?',
      response: 'Struggles',
      details:
        'Struggles to get comfortable. You wake up a few times a night because they are moving around trying to get comfortable.',
    },
    {
      questionNumber: '04',
      category: 'Mobility Monitoring',
      question: 'How easy/ difficult your pet finds walking?',
      response: 'Easy',
      details: 'No stiffness or limping',
    },
    {
      questionNumber: '05',
      category: 'Mobility Monitoring',
      question: 'Please rate how stiff your pet is after a period of rest.',
      response: 'Mild Stiffness',
      details:
        'Stiff for up to 15 minutes after getting off the bed/ floor.',
    },
    {
      questionNumber: '06',
      category: 'Pain Monitoring',
      question: 'How is your pet’s overall energy level?',
      response: 'Energetic',
      details: 'Plays well and is active throughout the day.',
    },
    {
      questionNumber: '07',
      category: 'Mobility Monitoring',
      question: 'How difficult does your pet find climbing stairs?',
      response: 'Moderate',
      details: 'Needs help occasionally while climbing stairs.',
    },
    {
      questionNumber: '08',
      category: 'Mobility Monitoring',
      question: 'How difficult does your pet find climbing stairs?',
      response: 'Moderate',
      details: 'Needs help occasionally while climbing stairs.',
    },
    {
      questionNumber: '09',
      category: 'Mobility Monitoring',
      question: 'How difficult does your pet find climbing stairs?',
      response: 'Moderate',
      details: 'Needs help occasionally while climbing stairs.',
    },
    {
      questionNumber: '10',
      category: 'Mobility Monitoring',
      question: 'How difficult does your pet find climbing stairs?',
      response: 'Moderate',
      details: 'Needs help occasionally while climbing stairs.',
    },
    {
      questionNumber: '11',
      category: 'Mobility Monitorinlg',
      question: 'How difficult does your pet find climbing stairs?',
      response: 'Moderate',
      details: 'Needs help occasionally while climbing stairs.',
    },
    {
      questionNumber: '12',
      category: 'Mobility Monitorkking',
      question: 'How difficult does your pet find climbing stairs?',
      response: 'Moderate',
      details: 'Needs help occasionally while climbing stairs.',
    },
    {
      questionNumber: '13',
      category: 'Mobility Monitokkring',
      question: 'How difficult does your pet find climbing stairs?',
      response: 'Moderate',
      details: 'Needs help occasionally while climbing stairs.',
    },
    {
      questionNumber: '14',
      category: 'Mobility Monhhitoring',
      question: 'How difficult does your pet find climbing stairs?',
      response: 'Moderate',
      details: 'Needs help occasionally while climbing stairs.',
    },
    {
      questionNumber: '15',
      category: 'Mobility Monitohhring',
      question: 'How difficult does your pet find climbing stairs?',
      response: 'Moderate',
      details: 'Needs help occasionally while climbing stairs.',
    }
  ];

  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 5;

  // Get the current page data
  const currentData = assessmentData.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  // Handlers for pagination
  const handleNext = () => {
    if (currentPage < Math.ceil(assessmentData.length / itemsPerPage) - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrev = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  return (

     <div className="assmtsec">

      <div className="accmthead">
        <h6>Assessment Responses <span>({assessmentData.length})</span> </h6>
      </div>

      <table className="assmttable">
        <thead>
          <tr>
            <th>Question</th>
            <th>Response</th>
          </tr>
        </thead>
        <tbody>
          {currentData.map((item, index) => (
            <tr key={index}>
              <td >
                <span>{item.questionNumber}</span>  <h5><strong>{item.category}</strong></h5> <br />
                <p className="details">{item.question}</p>
              </td>
              <td>
                <h5><strong>{item.response}</strong></h5> <br />
                <p >{item.details}</p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="assmtpagination">
        <button 
          onClick={handlePrev} 
          disabled={currentPage === 0}
        >
          <i className="ri-arrow-left-line"></i>
        </button>
        <h6 className='PaginationName'>
          Responses <span> {currentPage * itemsPerPage + 1} -{' '}
          {Math.min((currentPage + 1) * itemsPerPage, assessmentData.length)} 
          {/* of{' '}{assessmentData.length} */}
          </span>
        </h6>
        <button 
          onClick={handleNext} 
          disabled={currentPage >= Math.ceil(assessmentData.length / itemsPerPage) - 1}
        >
         <i className="ri-arrow-right-line"></i>
        </button>
      </div>
      
    </div>

  )
}

export default AssesmentResponse