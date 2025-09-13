import { postData } from "../axios-services/services";
import { useOldAuthStore } from "../stores/oldAuthStore";

export const handleLogout = async () => {
    const logout = useOldAuthStore.getState().logout;
  
    try {
      await postData("/api/auth/signOut", {}, { withCredentials: true });
      
      console.log("✅ Logout API called");
    } catch (error) {
      console.error("⚠️ Logout API error:", error);
    }
  
    logout(); // clear Zustand state
  };