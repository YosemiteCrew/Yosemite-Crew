import axios from 'axios';
// import { HospitalProfileNormalizer } from '../utils/FhirMapper';
// import { FhirProfileConverter } from '../utils/FhirMapper'; // Optional

// ✅ Fetch and normalize hospital profile
export const getProfiledata = async (userId) => {
  try {
    const response = await axios.get(
      `${process.env.NEXT_PUBLIC_BASE_URL}fhir/organization/${userId}`
    );

    const fhirData = response.data;
    console.log("fhirData", fhirData);

    // const profileData = new HospitalProfileNormalizer(fhirData).normalize();
    // return profileData;

  } catch (error) {
    console.error("Error fetching profile data:", error);
    throw error;
  }
};

// ✅ Fetch and normalize doctor profile
export const getdoctorprofile = async (userId) => {
  try {
    const response = await axios.get(
      `${process.env.NEXT_PUBLIC_BASE_URL}fhir/practitioner/${userId}`
    );

    const fhirDoctor = response.data;

    const [docResponse, scheduleResponse] = await Promise.all([
      axios.get(`${process.env.NEXT_PUBLIC_BASE_URL}fhir/documents/${userId}`),
      axios.get(`${process.env.NEXT_PUBLIC_BASE_URL}fhir/schedule/${userId}`),
    ]);

    const fhirDocuments = docResponse.data;
    const fhirSchedule = scheduleResponse.data;

    // If using a normalizer class, uncomment the below and make sure it exists:
    // const doctorData = new FhirProfileConverter(fhirDoctor, fhirDocuments, fhirSchedule).normalize();
    // return doctorData;

    return {
      fhirDoctor,
      fhirDocuments,
      fhirSchedule,
    };

  } catch (error) {
    console.error('Error fetching doctor profile data:', error);
    throw error;
  }
};
