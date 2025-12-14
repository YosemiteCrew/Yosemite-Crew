import { useEffect } from "react";
import { useAuthStore } from "@/app/stores/authStore";
import { useOrgStore } from "@/app/stores/orgStore";
import { loadOrgs } from "@/app/services/orgService";

export const useLoadOrg = () => {
  const authStatus = useAuthStore((s) => s.status);
  const orgStatus = useOrgStore((s) => s.status);

  const isAuthed =
    authStatus === "authenticated" || authStatus === "signin-authenticated";

  useEffect(() => {
    if (!isAuthed) return;
    if (orgStatus === "idle") {
      void loadOrgs();
    }
  }, [isAuthed, orgStatus]);
};
