import axios from "axios";
import { useCompanionStore } from "../stores/companionStore";
import { useOrgStore } from "../stores/orgStore";
import { getData, postData } from "./axios";
import {
  CompanionRequestDTO,
  fromCompanionRequestDTO,
  fromParentRequestDTO,
  ParentRequestDTO,
  toCompanionResponseDTO,
  toParentResponseDTO,
} from "@yosemite-crew/types";
import {
  GetCompanionResponse,
  StoredCompanion,
  StoredParent,
} from "../pages/Companions/types";
import { useParentStore } from "../stores/parentStore";

export const loadCompanionsForPrimaryOrg = async (opts?: {
  silent?: boolean;
  force?: boolean;
}) => {
  const { startLoading, setError, setCompanionsForOrg, status, lastFetchedAt } =
    useCompanionStore.getState();
  const { addBulkParents } = useParentStore.getState();
  const { primaryOrgId } = useOrgStore.getState();
  if (!primaryOrgId) {
    console.warn("No primary organization selected. Cannot load companions.");
    return;
  }
  if (!shouldFetchCompanions(status, lastFetchedAt, opts)) return;
  if (!opts?.silent) {
    startLoading();
  }
  try {
    const res = await getData<GetCompanionResponse>(
      "/v1/companion-organisation/pms/" + primaryOrgId + "/list"
    );
    const companionById = new Map<string, StoredCompanion>();
    const parentById = new Map<string, StoredParent>();
    for (const data of res.data) {
      if (!data.companion || !data.parent) {
        continue;
      }
      const tempCompanion = fromCompanionRequestDTO(data.companion);
      const tempParent = fromParentRequestDTO(data.parent);
      const companionId = tempCompanion.id!;
      const parentId = tempParent.id!;
      companionById.set(companionId, {
        ...tempCompanion,
        id: companionId,
        organisationId: primaryOrgId,
        parentId,
      });
      parentById.set(parentId, {
        ...tempParent,
        id: parentId,
      });
    }
    console.log(companionById)
    setCompanionsForOrg(primaryOrgId, Array.from(companionById.values()));
    addBulkParents(Array.from(parentById.values()));
  } catch (err: any) {
    if (!opts?.silent) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 403) {
          setError("You don't have permission to fetch companions.");
        } else if (status === 404) {
          setError("Companion service not found. Please contact support.");
        } else {
          setError(
            err.response?.data?.message ??
              err.message ??
              "Failed to load companions"
          );
        }
      } else {
        setError("Unexpected error while fetching companions");
      }
    }
    console.error("Failed to load orgs:", err);
    throw err;
  }
};

const shouldFetchCompanions = (
  status: ReturnType<typeof useCompanionStore.getState>["status"],
  lastFetchedAt: string | null,
  opts?: { force?: boolean }
) => {
  if (opts?.force) return true;
  if (status === "loading") return false;
  if (status === "loaded" && lastFetchedAt) return false;
  return status === "idle" || status === "error";
};

export const createCompanion = async (
  payload: StoredCompanion,
  parentPayload: StoredParent
) => {
  const { upsertCompanion } = useCompanionStore.getState();
  const { upsertParent } = useParentStore.getState();
  const { primaryOrgId } = useOrgStore.getState();
  if (!primaryOrgId) {
    console.warn("No primary organization selected. Cannot load companions.");
    return;
  }
  try {
    const fhirCompanion = toCompanionResponseDTO(payload);
    const body = {
      payload: fhirCompanion,
      parentId: payload.parentId,
    };
    const res = await postData<CompanionRequestDTO>(
      "/fhir/v1/companion/org/" + primaryOrgId,
      body
    );
    const normalCompanion = fromCompanionRequestDTO(res.data);
    const newCompanion: StoredCompanion = {
      ...normalCompanion,
      id: normalCompanion.id!,
      parentId: payload.parentId,
      organisationId: primaryOrgId,
    };
    upsertParent(parentPayload);
    upsertCompanion(newCompanion);
  } catch (err) {
    console.error("Failed to create service:", err);
    throw err;
  }
};

export const createParent = async (payload: StoredParent) => {
  const { upsertParent } = useParentStore.getState();
  const { primaryOrgId } = useOrgStore.getState();
  if (!primaryOrgId) {
    console.warn("No primary organization selected. Cannot load companions.");
    return;
  }
  try {
    const fhirParent = toParentResponseDTO(payload);
    const res = await postData<ParentRequestDTO>(
      "/fhir/v1/parent/pms/parents",
      fhirParent
    );
    const normalParent = fromParentRequestDTO(res.data);
    const newParent: StoredParent = {
      ...normalParent,
      id: normalParent.id!,
    };
    upsertParent(newParent);
    return normalParent.id;
  } catch (err) {
    console.error("Failed to create service:", err);
    throw err;
  }
};

export const linkCompanion = async (
  payload: StoredCompanion,
  parentPayload: StoredParent
) => {
  const { primaryOrgId } = useOrgStore.getState();
  const { upsertParent } = useParentStore.getState();
  const { upsertCompanion } = useCompanionStore.getState();
  if (!primaryOrgId) {
    console.warn("No primary organization selected. Cannot load companions.");
    return;
  }
  try {
    await postData<ParentRequestDTO>(
      "/v1/companion-organisation/pms/" +
        primaryOrgId +
        "/" +
        payload.id +
        "/link"
    );
    const newCompanion: StoredCompanion = {
      ...payload,
      organisationId: primaryOrgId,
    };
    upsertCompanion(newCompanion);
    upsertParent(parentPayload);
  } catch (err) {
    console.error("Failed to create service:", err);
    throw err;
  }
};

export const searchParent = async (
  name: string,
  signal?: AbortSignal
): Promise<StoredParent[]> => {
  try {
    if (!name) {
      return [];
    }
    const res = await getData<ParentRequestDTO[]>(
      "/fhir/v1/parent/pms/search?name=" + encodeURIComponent(name),
      { signal }
    );
    return res.data.map((fhirParent) => {
      const normalParent = fromParentRequestDTO(fhirParent);
      return { ...normalParent, id: normalParent.id! };
    });
  } catch (err: any) {
    if (err?.name === "CanceledError" || err?.code === "ERR_CANCELED") {
      return [];
    }
    console.error("Failed to create service:", err);
    throw err;
  }
};

export const getCompanionForParent = async (
  parentId: string
): Promise<StoredCompanion[]> => {
  const { primaryOrgId } = useOrgStore.getState();
  if (!primaryOrgId) {
    console.warn("No primary organization selected. Cannot load companions.");
    return [];
  }
  try {
    if (!parentId) {
      return [];
    }
    const res = await getData<CompanionRequestDTO[]>(
      "/fhir/v1/companion/pms/" + parentId + "/" + primaryOrgId + "/list"
    );
    const normalCompanions: StoredCompanion[] = [];
    for (const fhirCompanion of res.data) {
      const normalCompanion = fromCompanionRequestDTO(fhirCompanion);
      const newCompanion: StoredCompanion = {
        ...normalCompanion,
        id: normalCompanion.id!,
        parentId: parentId,
        organisationId: "",
      };
      normalCompanions.push(newCompanion);
    }
    return normalCompanions;
  } catch (err) {
    console.error("Failed to create service:", err);
    throw err;
  }
};
