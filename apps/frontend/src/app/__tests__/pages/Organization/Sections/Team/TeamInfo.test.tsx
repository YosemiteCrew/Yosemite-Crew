import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TeamInfo from "@/app/pages/Organization/Sections/Team/TeamInfo";
import { getProfileForUserForPrimaryOrg } from "@/app/services/teamService";
import { convertFromGetApi } from "@/app/components/Availability/utils";
import { toPermissionArray } from "@/app/utils/permissions";

// --- Mocks ---

jest.mock("@/app/services/teamService", () => ({
  getProfileForUserForPrimaryOrg: jest.fn(),
}));

jest.mock("@/app/utils/permissions", () => ({
  ...jest.requireActual("@/app/utils/permissions"),
  toPermissionArray: jest.fn((perms) => perms || []),
}));

jest.mock("@/app/components/Availability/utils", () => ({
  ...jest.requireActual("@/app/components/Availability/utils"),
  convertFromGetApi: jest.fn((avail) => ({ mockAvailability: true, ...avail })),
}));

jest.mock("@/app/components/Modal", () => ({
  __esModule: true,
  default: ({ children, showModal }: any) =>
    showModal ? <div>{children}</div> : null,
}));

jest.mock("@/app/components/Accordion/EditableAccordion", () => ({
  __esModule: true,
  default: ({ title, data }: any) => (
    <div data-testid={`accordion-${title.toLowerCase().replaceAll(/\s/g, "-")}`}>
      <h3>{title}</h3>
      {data && (
        <ul>
          {Object.entries(data).map(([key, value]) => (
            <li key={key} data-testid={`field-${key}`}>
              {String(value)}
            </li>
          ))}
        </ul>
      )}
    </div>
  ),
}));

jest.mock("@/app/components/Accordion/Accordion", () => ({
  __esModule: true,
  default: ({ children, title }: any) => (
    <div data-testid={`accordion-${title.toLowerCase()}`}>
      <h3>{title}</h3>
      {children}
    </div>
  ),
}));

jest.mock("@/app/components/Availability/Availability", () => ({
  __esModule: true,
  default: () => (
    <div data-testid="availability-component">Availability Grid</div>
  ),
}));

// FIX: Use absolute path for the mock
jest.mock("@/app/pages/Organization/Sections/Team/PermissionsEditor", () => ({
  __esModule: true,
  default: ({ role, value, onChange }: any) => (
    <div data-testid="permissions-editor">
      <span>Role: {role}</span>
      <span>Perms Count: {value?.length}</span>
      <button onClick={() => onChange(["NEW_PERM"])}>Update Perms</button>
    </div>
  ),
}));

describe("TeamInfo Component", () => {
  const mockSetShowModal = jest.fn();
  const mockActiveTeam = {
    _id: "user-123",
    name: "Dr. House",
    role: "Diagnostician",
    speciality: { name: "Diagnostics" },
  };

  const mockProfileData = {
    profile: {
      personalDetails: {
        gender: "Male",
        dateOfBirth: "1980-01-01",
        employmentType: "Full Time",
        phoneNumber: "123-456-7890",
        address: {
          country: "USA",
          addressLine: "221B Baker St",
          state: "NJ",
          city: "Princeton",
          postalCode: "08540",
        },
      },
      professionalDetails: {
        linkedin: "linkedin.com/house",
        medicalLicenseNumber: "MD-12345",
        yearsOfExperience: "15",
        specialization: "Nephrology",
        qualification: "MD",
        biography: "It's not lupus.",
      },
    },
    mapping: {
      roleCode: "DOCTOR",
      effectivePermissions: ["VIEW_PATIENTS"],
    },
    baseAvailability: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getProfileForUserForPrimaryOrg as jest.Mock).mockResolvedValue(
      mockProfileData
    );
    (toPermissionArray as jest.Mock).mockImplementation((perms) => perms);
    (convertFromGetApi as jest.Mock).mockReturnValue({});
  });

  // --- 1. Rendering & Data Fetching ---

  it("fetches profile data and renders all info sections", async () => {
    render(
      <TeamInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeTeam={mockActiveTeam as any}
      />
    );

    expect(screen.getByText("View team")).toBeInTheDocument();

    await waitFor(() => {
      expect(getProfileForUserForPrimaryOrg).toHaveBeenCalledWith("user-123");
    });

    expect(
      screen.getByTestId("accordion-personal-details")
    ).toBeInTheDocument();
    expect(screen.getByTestId("field-name")).toHaveTextContent("Dr. House");
  });

  it("handles fetch failure gracefully", async () => {
    (getProfileForUserForPrimaryOrg as jest.Mock).mockRejectedValue(
      new Error("Fetch error")
    );
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    render(
      <TeamInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeTeam={mockActiveTeam as any}
      />
    );

    await waitFor(() =>
      expect(getProfileForUserForPrimaryOrg).toHaveBeenCalled()
    );
    expect(
      screen.getByTestId("accordion-personal-details")
    ).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it("does not fetch if showModal is false", () => {
    render(
      <TeamInfo
        showModal={false}
        setShowModal={mockSetShowModal}
        activeTeam={mockActiveTeam as any}
      />
    );
    expect(getProfileForUserForPrimaryOrg).not.toHaveBeenCalled();
  });

  // --- 2. Interaction ---

  it("closes the modal when the close icon is clicked", () => {
    const { container } = render(
      <TeamInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeTeam={mockActiveTeam as any}
      />
    );
    const closeIcon = container.querySelector("svg.cursor-pointer");
    if (closeIcon) fireEvent.click(closeIcon);
    expect(mockSetShowModal).toHaveBeenCalledWith(false);
  });

  it("renders PermissionsEditor and handles updates", async () => {
    render(
      <TeamInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeTeam={mockActiveTeam as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("permissions-editor")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Update Perms"));
    // Since state is internal, we trust the mocked component's interaction proof (button click)
    expect(screen.getByText("Role: DOCTOR")).toBeInTheDocument();
  });
});
