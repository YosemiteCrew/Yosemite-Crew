import MedicalRecordsTable from "@/app/Components/DataTable/MedicalRecordsTable";
import UpcomingConsultationsTable from "@/app/Components/DataTable/UpcomingConsultationsTable";

// Upcoming Consultations Started  
export const UpcomingConst = [
    {
      eventKey: "Appointments",
      title: "Appointments",
      content: (
        <>
        <UpcomingConsultationsTable/>
          
        </>
      ),
    },
    {
      eventKey: "Assessments",
      title: "Assessments",
      content: (
        <>
          <UpcomingConsultationsTable/>
        </>
      ),
    },
  ];

// Upcoming Consultations Ended 

// Medical Record Started  
export const medicalrecord = [
    {
      eventKey: "Appointments",
      title: "Appointments",
      content: (
        <>
            <MedicalRecordsTable/>
        </>
      ),
    },
    {
      eventKey: "Assessments",
      title: "Assessments",
      content: (
        <>
          <MedicalRecordsTable/>
        </>
      ),
    },
    {
      eventKey: "Prescriptions",
      title: "Prescriptions",
      content: (
        <>
          <MedicalRecordsTable/>
        </>
      ),
    },
    {
      eventKey: "Vaccination",
      title: "Vaccination",
      content: (
        <>
          <MedicalRecordsTable/>
        </>
      ),
    },
    {
      eventKey: "Procedures",
      title: "Procedures",
      content: (
        <>
          <MedicalRecordsTable/>
        </>
      ),
    },
    {
      eventKey: "Surgeries",
      title: "Surgeries",
      content: (
        <>
          <MedicalRecordsTable/>
        </>
      ),
    },
  ];

// Medical Record Ended  

