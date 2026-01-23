import { useAuthStore } from "../stores/authStore";
import { patchData } from "./axios";

export const updateUser = async (firstName: string, lastName: string) => {
  const { refreshSession, loadUserAttributes } = useAuthStore.getState();
  try {
    const body = {
      firstName,
      lastName,
    };
    await patchData("/fhir/v1/user/update-name", body);
    await refreshSession();
    await loadUserAttributes();
  } catch (err) {
    console.error("Failed to create service:", err);
    throw err;
  }
};
