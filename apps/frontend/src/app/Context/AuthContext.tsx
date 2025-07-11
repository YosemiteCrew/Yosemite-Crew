"use client"; // Needed for App Router to use hooks

import {
  createContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
  useContext,
} from "react";
import { jwtDecode } from "jwt-decode";
import { getProfiledata, getdoctorprofile } from "../profileApi/Api";

// Type for user role
type UserType = "Hospital" | "Groomer Shop" | "Doctor" | string;

// Decoded token type (match your token payload)
type DecodedTokenType = {
  userId: string;
  userType: UserType;
  [key: string]: string;
};

// Profile data type for hospital/groomer
type ProfileDataType = {
  logoUrl?: string;
  businessName?: string;
  activeModes?: string[];
};

// Doctor profile (adjust if you have full type)
type DoctorProfileType = string;

// Context value type
type AuthContextType = {
  userId: string | null;
  tokens: string | null;
  userType: UserType | null;
  profileData: ProfileDataType | null;
  doctorProfile: DoctorProfileType | null;
  initializeUser: () => void;
  refreshProfileData: (userId: string, userType: string) => void;
  onLogout: (navigate: (path: string) => void) => void;
};

// Context
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [userId, setUserId] = useState<string | null>(null);
  const [tokens, setTokens] = useState<string | null>(null);
  const [userType, setUserType] = useState<UserType | null>(null);
  const [profileData, setProfileData] = useState<ProfileDataType | null>(null);
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfileType | null>(null);

  // Decode token and initialize state
  const initializeUser = useCallback(() => {
  const token = sessionStorage.getItem("token");

  if (token) {
    try {
      const decodedToken = jwtDecode<DecodedTokenType>(token);
      setTokens(token);
      setUserId(decodedToken.userId);
      setUserType(decodedToken.userType);
    } catch (error) {
      console.error("Error decoding token:", error);
    }
  }
}, []);


  useEffect(() => {
    initializeUser();
  }, [initializeUser]);

  // Fetch profile based on userType
  const refreshProfileData = async (userId: string, userType: string) => {
    try {
      if (userType === "Hospital" || userType === "Groomer Shop") {
        const data = await getProfiledata(userId) as any;
        setProfileData({
          logoUrl: data.logoUrl,
          businessName: data.businessName,
          activeModes: data.activeModes,
        });
      } else if (userType === "Doctor") {
        const data = await getdoctorprofile(userId) as any;
        setProfileData({
          logoUrl: data.personalInfo.image,
          businessName: `${data.personalInfo.firstName} ${data.personalInfo.lastName}`,
        });
        setDoctorProfile(data);
      } else {
        console.warn("Unhandled userType:", userType);
      }
    } catch (error) {
      console.error("Error fetching profile data:", error);
    }
  };

  // Logout
  const onLogout = (navigate: (path: string) => void) => {
    sessionStorage.removeItem("token");
    setTokens(null);
    setUserId(null);
    setUserType(null);
    setProfileData(null);
    setDoctorProfile(null);
    setTimeout(() => {
      navigate("/signin");
    }, 100);
  };

  return (
    <AuthContext.Provider
      value={{
        userId,
        tokens,
        userType,
        profileData,
        doctorProfile,
        initializeUser,
        refreshProfileData,
        onLogout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// ✅ Custom hook for consuming context safely
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
