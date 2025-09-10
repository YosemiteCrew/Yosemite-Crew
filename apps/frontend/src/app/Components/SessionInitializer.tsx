"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "../stores/authStore";
import { postData } from "../axios-services/services";
import { usePathname } from "next/navigation";
import { handleLogout } from "../utils/LogoutApi";
import HomePage from "../Pages/HomePage/HomePage";
import Header from "./Header/Header";
import MainLandingPage from "../Pages/MainLandingPage/MainLandingPage";
import Cookies from "./Cookies/Cookies";
import Github from "./Github/Github";

// ✅ Define roles outside to avoid re-declaring them on every render
const VET_ROLES = [
  "vet",
  "vetTechnician",
  "nurse",
  "vetAssistant",
  "receptionist",
];

const publicRoutes = [
  "/signup",
  "/signin",
  "/landingpage",
  "/homepage",
  "/petowner",
  "/resources",
  "/contact_us",
  "/blogpage",
  "/developerlanding",
  "/about_us",
  "/bookDemo",
  "/privacypolicy",
  "/pricing",
  "/termsandconditions",
  "",
];

const SessionInitializer = ({ children }: { children: React.ReactNode }) => {
  const setUser = useAuthStore((state) => state.setUser);
  const setVerified = useAuthStore((state) => state.setVerified);
  const isVerified = useAuthStore((state) => state.isVerified);
  const { fetchBusinessProfile, fetchVetAndTeamsProfile } = useAuthStore(
    (state) => state
  );
  const [loading, setLoading] = useState(true);
  const [showGithub, setShowGithub] = useState(true);
  const pathname = usePathname();

  const isPublicRoute = publicRoutes.some(
    (route) =>
      pathname === route ||
      (route.includes("") && matchDynamicRoute(route, pathname))
  );

  function matchDynamicRoute(pattern: string, path: string) {
    const patternRegex = new RegExp(
      "^" + pattern.replace(/\[.*?\]/g, "[^/]+") + "$"
    );
    return patternRegex.test(path);
  }
  console.log(isVerified, "isVerified in SessionInitializer", isPublicRoute);
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response: any = await postData(
          "/api/auth/refreshToken",
          {},
          { withCredentials: true }
        );
        const { userId, email, userType, isVerified } = response.data.data;
        setUser({ userId, email, userType, isVerified });
        setVerified(isVerified);
        console.log("✅ User restored:", { userId, email, userType });

        if (userType && isVerified && !VET_ROLES.includes(userType)) {
          fetchBusinessProfile();
        } else {
          fetchVetAndTeamsProfile(userId);
        }
      } catch (err) {
        await handleLogout();
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [
    fetchBusinessProfile,
    fetchVetAndTeamsProfile,
    // isVerified,
    setUser,
    // setVerified,
  ]);

  if (loading) return null;
  if (isVerified === 0 && (pathname == "/emptydashboard" || isPublicRoute)) {
    return (
      <>
        <Header />
        <Cookies />
        <Github isOpen={showGithub} onClose={() => setShowGithub(false)} />
        <div className="bodywrapper">{children}</div>
      </>
    );
  } else if (
    (isVerified === -1 || isVerified === 0 || isVerified == null) &&
    !isPublicRoute
  ) {
    return (
      <>
        <Header />
        <Cookies />
        <Github isOpen={showGithub} onClose={() => setShowGithub(false)} />
        <div className="bodywrapper">
          <MainLandingPage />
        </div>
      </>
    );
  } else if (isVerified == null && isPublicRoute) {
    return (
      <>
        <Header />
        <Cookies />
        <Github isOpen={showGithub} onClose={() => setShowGithub(false)} />
        <div className="bodywrapper">{children}</div>
      </>
    );
  } else if (isVerified === 1) {
    return (
      <>
        <Header />
        <Cookies />
        <Github isOpen={showGithub} onClose={() => setShowGithub(false)} />
        <div className="bodywrapper">{children}</div>
      </>
    );
  }
  return null;
};

export default SessionInitializer;
