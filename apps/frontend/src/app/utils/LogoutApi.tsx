import { postData } from "../axios-services/services";
import { useAuthStore } from "../stores/authStore";

export const handleLogout = async () => {
    const logout = useAuthStore.getState().logout;
  
    try {
      await postData("fhir/signOut", {}, { withCredentials: true });
      console.log("✅ Logout API called");
    } catch (error) {
      console.error("⚠️ Logout API error:", error);
    }
  
    logout(); // clear Zustand state
  };