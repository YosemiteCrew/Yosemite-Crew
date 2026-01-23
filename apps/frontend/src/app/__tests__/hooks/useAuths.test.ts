import { renderHook, act } from "@testing-library/react";
import { useSignOut } from "../../hooks/useAuth";

// --- Mock Actions ---
const mockSignOutAction = jest.fn();
const mockClearOrgs = jest.fn();
const mockClearTeams = jest.fn();
const mockClearAppointments = jest.fn();
const mockClearAvailabilities = jest.fn();
const mockClearCompanions = jest.fn();
const mockClearDocuments = jest.fn();
const mockClearForms = jest.fn();
const mockClearInventory = jest.fn();
const mockClearParents = jest.fn();
const mockClearProfiles = jest.fn();
const mockClearRooms = jest.fn();
const mockClearServices = jest.fn();
const mockClearSpecialities = jest.fn();

// --- Mock Stores ---
// We assume the hook uses selectors: useStore((state) => state.action)
// So we mock the hooks to execute the selector against a mocked state object.

jest.mock("@/app/stores/authStore", () => {
  const useAuthStore = (selector: any) =>
    selector({ signout: mockSignOutAction });
  useAuthStore.getState = () => ({ signout: mockSignOutAction });
  return { useAuthStore };
});
jest.mock("@/app/stores/orgStore", () => {
  const useOrgStore = (selector: any) => selector({ clearOrgs: mockClearOrgs });
  useOrgStore.getState = () => ({ clearOrgs: mockClearOrgs });
  return { useOrgStore };
});
jest.mock("@/app/stores/teamStore", () => {
  const useTeamStore = (selector: any) => selector({ clearTeams: mockClearTeams });
  useTeamStore.getState = () => ({ clearTeams: mockClearTeams });
  return { useTeamStore };
});
jest.mock("@/app/stores/appointmentStore", () => {
  const useAppointmentStore = (selector: any) =>
    selector({ clearAppointments: mockClearAppointments });
  useAppointmentStore.getState = () => ({
    clearAppointments: mockClearAppointments,
  });
  return { useAppointmentStore };
});
jest.mock("@/app/stores/availabilityStore", () => {
  const useAvailabilityStore = (selector: any) =>
    selector({ clearAvailabilities: mockClearAvailabilities });
  useAvailabilityStore.getState = () => ({
    clearAvailabilities: mockClearAvailabilities,
  });
  return { useAvailabilityStore };
});
jest.mock("@/app/stores/companionStore", () => {
  const useCompanionStore = (selector: any) =>
    selector({ clearCompanions: mockClearCompanions });
  useCompanionStore.getState = () => ({
    clearCompanions: mockClearCompanions,
  });
  return { useCompanionStore };
});
jest.mock("@/app/stores/documentStore", () => {
  const useOrganizationDocumentStore = (selector: any) =>
    selector({ clearDocuments: mockClearDocuments });
  useOrganizationDocumentStore.getState = () => ({
    clearDocuments: mockClearDocuments,
  });
  return { useOrganizationDocumentStore };
});
jest.mock("@/app/stores/formsStore", () => {
  const useFormsStore = (selector: any) => selector({ clear: mockClearForms });
  useFormsStore.getState = () => ({ clear: mockClearForms });
  return { useFormsStore };
});
jest.mock("@/app/stores/inventoryStore", () => {
  const useInventoryStore = (selector: any) =>
    selector({ clearAll: mockClearInventory });
  useInventoryStore.getState = () => ({ clearAll: mockClearInventory });
  return { useInventoryStore };
});
jest.mock("@/app/stores/parentStore", () => {
  const useParentStore = (selector: any) =>
    selector({ clearParents: mockClearParents });
  useParentStore.getState = () => ({ clearParents: mockClearParents });
  return { useParentStore };
});
jest.mock("@/app/stores/profileStore", () => {
  const useUserProfileStore = (selector: any) =>
    selector({ clearProfiles: mockClearProfiles });
  useUserProfileStore.getState = () => ({
    clearProfiles: mockClearProfiles,
  });
  return { useUserProfileStore };
});
jest.mock("@/app/stores/roomStore", () => {
  const useOrganisationRoomStore = (selector: any) =>
    selector({ clearRooms: mockClearRooms });
  useOrganisationRoomStore.getState = () => ({ clearRooms: mockClearRooms });
  return { useOrganisationRoomStore };
});
jest.mock("@/app/stores/serviceStore", () => {
  const useServiceStore = (selector: any) =>
    selector({ clearServices: mockClearServices });
  useServiceStore.getState = () => ({ clearServices: mockClearServices });
  return { useServiceStore };
});
jest.mock("@/app/stores/specialityStore", () => {
  const useSpecialityStore = (selector: any) =>
    selector({ clearSpecialities: mockClearSpecialities });
  useSpecialityStore.getState = () => ({
    clearSpecialities: mockClearSpecialities,
  });
  return { useSpecialityStore };
});

describe("useSignOut Hook", () => {
  // Setup LocalStorage Mock
  const localStorageMock = (function () {
    let store: Record<string, string> = {};
    return {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value.toString();
      },
      removeItem: jest.fn((key: string) => {
        delete store[key];
      }),
      clear: () => {
        store = {};
      },
    };
  })();

  beforeAll(() => {
    Object.defineProperty(globalThis, "localStorage", {
      value: localStorageMock,
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Section 1: Success Path ---
  it("executes signout, clears all stores, and removes local storage item", async () => {
    mockSignOutAction.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useSignOut());

    await act(async () => {
      await result.current.signOut();
    });

    // 1. Check Auth Signout
    expect(mockSignOutAction).toHaveBeenCalledTimes(1);

    // 2. Check All Store Clears
    expect(mockClearOrgs).toHaveBeenCalled();
    expect(mockClearTeams).toHaveBeenCalled();
    expect(mockClearAppointments).toHaveBeenCalled();
    expect(mockClearAvailabilities).toHaveBeenCalled();
    expect(mockClearCompanions).toHaveBeenCalled();
    expect(mockClearDocuments).toHaveBeenCalled();
    expect(mockClearForms).toHaveBeenCalled();
    expect(mockClearInventory).toHaveBeenCalled();
    expect(mockClearParents).toHaveBeenCalled();
    expect(mockClearProfiles).toHaveBeenCalled();
    expect(mockClearRooms).toHaveBeenCalled();
    expect(mockClearServices).toHaveBeenCalled();
    expect(mockClearSpecialities).toHaveBeenCalled();

    // 3. Check Local Storage
    expect(localStorage.removeItem).toHaveBeenCalledWith("org-store");
  });

  // --- Section 2: Error Handling (Finally Block) ---
  it("clears all stores even if signout API call fails", async () => {
    const error = new Error("Network Error");
    mockSignOutAction.mockRejectedValueOnce(error);

    const { result } = renderHook(() => useSignOut());

    // We expect the error to bubble up, but the cleanup must still happen
    await expect(
      act(async () => {
        await result.current.signOut();
      })
    ).rejects.toThrow("Network Error");

    // Assert cleanup still occurred (The 'finally' block behavior)
    expect(mockClearOrgs).toHaveBeenCalled();
    expect(mockClearTeams).toHaveBeenCalled();
    expect(localStorage.removeItem).toHaveBeenCalledWith("org-store");
  });

  // --- Section 3: Local Storage Resilience ---
  it("does not crash if localStorage throws an error", async () => {
    mockSignOutAction.mockResolvedValueOnce(undefined);

    // Simulate access denied or environment error for localStorage
    jest.spyOn(localStorage, "removeItem").mockImplementationOnce(() => {
      throw new Error("Access Denied");
    });

    const { result } = renderHook(() => useSignOut());

    // Should complete without throwing
    await act(async () => {
      await result.current.signOut();
    });

    expect(mockSignOutAction).toHaveBeenCalled();
    expect(mockClearOrgs).toHaveBeenCalled();
    // Verify the mock threw but was caught internally
    expect(localStorage.removeItem).toHaveBeenCalledWith("org-store");
  });
});
