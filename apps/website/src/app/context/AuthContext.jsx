import { createContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import { getProfiledata, getdoctorprofile } from '../profileApis/Api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [userId, setUserId] = useState(null);
  const [tokens, setTokens] = useState(null);
  const [userType, setUserType] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [doctorProfile, setDoctorProfile] = useState(null);

  console.log('User Type:', userType);
  const initializeUser = async () => {
    const token = sessionStorage.getItem('token');

    if (token) {
      try {
        const decodedToken = jwtDecode(token);
        setTokens(token);
        setUserId(decodedToken.userId);
        setUserType(decodedToken.userType);

        await refreshProfileData(decodedToken.userId, decodedToken.userType);
      } catch (error) {
        console.error('Error decoding token:', error);
      }
    }
  };

  useEffect(() => {
    initializeUser();
  }, []);

  const refreshProfileData = async (userId, userType) => {
    try {
      if (userType === 'Hospital') {
        const data = await getProfiledata(userId);
        setProfileData({
          logoUrl: data.logoUrl,
          businessName: data.businessName,
          activeModes: data.activeModes,
        });
      } else if (userType === 'Doctor') {
        const data = await getdoctorprofile(userId);
        setProfileData({
          logoUrl: data.personalInfo.image,
          businessName: `${data.personalInfo.firstName} ${data.personalInfo.lastName}`,
        });
        setDoctorProfile(data);
      } else {
        console.warn('Unhandled userType:', userType);
      }
    } catch (error) {
      console.error('Error fetching profile data:', error);
    }
  };

  const onLogout = async (navigate) => {
    sessionStorage.removeItem('token');
    setTokens(null);
    setUserId(null);
    setUserType(null);
    setProfileData(null);
    setTimeout(() => {
      navigate('/signin'); // Ensures navigation happens after state is cleared
    }, 100);
  };

  return (
    <AuthContext.Provider
      value={{
        userId,
        tokens,
        userType,
        profileData,
        refreshProfileData,
        onLogout,
        doctorProfile,
        initializeUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
