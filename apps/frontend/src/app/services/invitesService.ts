import { useInviteStore } from "@/app/stores/inviteStore";
import { getData } from "@/app/services/axios";
import { InviteProps } from "../types/org";
import { demoInvites } from "../demo/demo";

export const loadInvites = async () => {
  const { startLoading, setInvites, setError } = useInviteStore.getState();

  startLoading();
  try {
    const res = await getData<InviteProps[]>("/invites");
    setInvites(res.data);
  } catch (err: any) {
    setInvites(demoInvites);
    console.error("Failed to load invites:", err);
    setError(err?.message ?? "Failed to load invites");
  }
};
