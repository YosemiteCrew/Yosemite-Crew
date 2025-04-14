import axios from 'axios';
import {  HospitalProfileNormalizer } from '../utils/FhirMapper';




// ✅ Fetch and normalize data from the FHIR response
export const getProfiledata = async (userId) => {
  try {
    // 🔥 Fetch FHIR profile data from the backend
    const response = await axios.get(
      `${import.meta.env.VITE_BASE_URL}fhir/organization/${userId}`
    );

    const fhirData = response.data;

    console.log("fhirData",fhirData);
    const profileData = new HospitalProfileNormalizer(fhirData).normalize();

  
    return profileData;

  } catch (error) {
    console.error("Error fetching profile data:", error);
    throw error;
  }
};



export const getdoctorprofile = async (userId) => {
  try {
    const response = await axios.get(
      `${import.meta.env.VITE_BASE_URL}api/doctors/getDoctors/${userId}`
    );
    // console.log(response.data);
    return response.data;
  } catch (error) {
    console.error('Error fetching doctor profile data:', error);
    throw error;
  }
};
// export const checkAndRefreshToken = async (navigate) => {
//   const refreshToken = sessionStorage.getItem("refreshToken");

//   if (refreshToken) {
//     try {
//       console.log("helllllll", refreshToken);
//       const refreshResponse = await axios.post(
//         `${import.meta.env.VITE_BASE_URL}api/doctors/refreshToken`,
//         { refreshToken }
//       );

//       if (refreshResponse.status === 200) {
//         console.log("refreshResponse.data.token", refreshResponse.data.token);
//         sessionStorage.setItem("token", refreshResponse.data.token);
//         sessionStorage.setItem(
//           "refreshToken",
//           refreshResponse.data.refreshToken
//         );
//         return true;
//       }
//     } catch (error) {
//       console.error("Failed to refresh token:", error);
//       navigate("/signin");
//       return false;
//     }
//   } else {
//     console.error("No refresh token found.");
//     navigate("/signin");
//     return false;
//   }
// };
