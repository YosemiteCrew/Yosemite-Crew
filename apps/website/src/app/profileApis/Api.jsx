import axios from 'axios';




// ✅ Fetch and normalize data from the FHIR response
export const getProfiledata = async (userId) => {
  try {
    // 🔥 Fetch FHIR profile data from the backend
    const response = await axios.get(
      `${process.env.NX_PUBLIC_VITE_BASE_URL}fhir/organization/${userId}`
    );

    const fhirData = response.data;

    // ✅ Extract Organization Resource
    const organizationEntry = fhirData.entry.find(
      (entry) => entry.resource.resourceType === "Organization"
    );

    const organization = organizationEntry?.resource || {};

    // ✅ Extract Document References
    const documentEntries = fhirData.entry.filter(
      (entry) => entry.resource.resourceType === "DocumentReference"
    );

    // ✅ Normalize the data
    const normalData = {
      _id: "67dcf983474db7072e2444a1", // Static _id (replace with dynamic if needed)
      userId: organization.id || "",
      __v: 0,
      activeModes: organization.active ? "true" : "false",
      businessName: organization.name || "",
      phoneNumber: organization.telecom?.[0]?.value || "",
      address: {
        addressLine1: organization.address?.[0]?.line?.[0] || "",
        city: organization.address?.[0]?.city || "",
        street: "Fillmore Street", // ✅ Static or hardcoded value
        state: organization.address?.[0]?.state || "",
        zipCode: organization.address?.[0]?.postalCode || "",
        latitude: "37.7913009", // ✅ Static latitude value
        longitude: "-122.434559", // ✅ Static longitude value
      },
      logo: organization.extension?.[0]?.valueUrl?.split("/").pop() || "",
      logoUrl: organization.extension?.[0]?.valueUrl || "",

      // ✅ Map prescription_upload data from S3 response
      prescription_upload: documentEntries.map((doc, index) => ({
        name: doc.resource.content?.[0]?.attachment?.url?.split("/").pop() || "",
        type: doc.resource.content?.[0]?.attachment?.contentType || "",
        date: doc.resource.date || new Date().toISOString(), // Add current date if missing
        _id: `67dcf983aaadd247ef00964${index + 1}`, // Simulated unique _id
      })),

      // ✅ Map prescriptionUploadUrl directly from S3 URL
      prescriptionUploadUrl: documentEntries.map((doc, index) => ({
        name: doc.resource.content?.[0]?.attachment?.url || "",
        type: doc.resource.content?.[0]?.attachment?.contentType || "",
        date: doc.resource.date || new Date().toISOString(),
        _id: `67dcf983aaadd247ef00964${index + 1}`,
      })),

      registrationNumber: "2014654629", // Static registration number
      selectedServices: [
        { code: "E001", display: "24/7 Emergency Care" },
        { code: "V001", display: "Veterinary ICU" },
        { code: "B001", display: "Behavioral Therapy" },
      ],
      yearOfEstablishment: "2018", // Static value
      website: "http://localhost:3000",
    };

    // ✅ Return formatted normal data
    return normalData;
  } catch (error) {
    console.error("Error fetching profile data:", error);
    throw error;
  }
};



export const getdoctorprofile = async (userId) => {
  try {
    const response = await axios.get(
      `${process.env.NX_PUBLIC_VITE_BASE_URL}api/doctors/getDoctors/${userId}`
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
