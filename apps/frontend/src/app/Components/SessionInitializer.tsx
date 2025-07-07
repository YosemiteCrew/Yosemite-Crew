// src/Components/SessionInitializer.tsx
"use client";

import { useEffect } from "react";
import { useAuthStore } from "../stores/authStore";
import { postData } from "../axios-services/services";

const SessionInitializer = () => {
  const setUser = useAuthStore((state) => state.setUser);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        // 👇 Try to refresh access token using cookie
       const response = await postData("/api/auth/refreshToken", {}, { withCredentials: true });
        const data = (response.data as { data: { userId: string; email: string; userType: string } }).data;
        const { userId, email, userType } = data;
             setUser({ userId, email, userType });

   
        console.log("✅ User restored from refresh:", { userId, email, userType });
      } catch (err) {
        console.log("❌ Not authenticated or refresh failed", err);
      }
    };

    fetchUser();
  }, [setUser]);

  return null; // No UI needed
};

export default SessionInitializer;
