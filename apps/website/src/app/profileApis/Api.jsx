import axios from 'axios';

export const getProfiledata = async (userId) => {
  try {
    const response = await axios.get(
      `${process.env.NX_PUBLIC_VITE_BASE_URL}api/auth/getProfile/${userId}`
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching profile data:', error);
    throw error;
  }
};

export const getdoctorprofile = async (userId) => {
  try {
    const response = await axios.get(
      `${process.env.NX_PUBLIC_VITE_BASE_URL}api/doctors/getDoctors/${userId}`
    );
    console.log(response.data);
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
//         `${process.env.NX_PUBLIC_VITE_BASE_URL}api/doctors/refreshToken`,
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
