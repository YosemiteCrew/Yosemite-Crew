"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "../stores/authStore";
import { postData } from "../axios-services/services";
// import SignIn from "../Pages/Sign/SignIn";
import { usePathname } from "next/navigation";
import { handleLogout } from "../utils/LogoutApi";
import HomePage from "../Pages/HomePage/HomePage";
import Header from "./Header/Header";

const publicRoutes = ["/signup", "/signin"]; // ✅ '/' NOT included (it's protected)

const SessionInitializer = ({ children }: { children: React.ReactNode }) => {
  const setUser = useAuthStore((state) => state.setUser);
  const setVerified = useAuthStore((state) => state.setVerified);
  const isVerified = useAuthStore((state) => state.isVerified);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  const isPublicRoute = publicRoutes.some(
    (route) =>
      pathname === route ||
      (route.includes("[") && matchDynamicRoute(route, pathname))
  );

  // ✅ Handle dynamic route matching like /blog/[slug]
  function matchDynamicRoute(pattern: string, path: string) {
    const patternRegex = new RegExp(
      "^" + pattern.replace(/\[.*?\]/g, "[^/]+") + "$"
    );
    return patternRegex.test(path);
  }

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response: any = await postData(
          "/api/auth/refreshToken",
          {},
          { withCredentials: true }
        );
        const { userId, email, userType } = response.data.data;
        setUser({ userId, email, userType });
        setVerified(true);
        console.log("✅ User restored:", { userId, email, userType });
      } catch (err) {
        await handleLogout();
        setVerified(false);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  if (loading) return null;

  if (!isVerified && !isPublicRoute) {
    return (
      <>
        <Header />
        <HomePage />;
      </>
    );
  }

  return (
    <>
      <Header />
      {children}
    </>
  );
};

export default SessionInitializer;
