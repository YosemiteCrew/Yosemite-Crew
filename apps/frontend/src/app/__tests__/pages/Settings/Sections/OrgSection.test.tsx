import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import OrgSection from "@/app/pages/Settings/Sections/OrgSection";
import * as availabilityUtils from "@/app/components/Availability/utils";

const usePrimaryOrgWithMembershipMock = jest.fn();
const usePrimaryAvailabilityMock = jest.fn();
const usePrimaryOrgProfileMock = jest.fn();

jest.mock("@/app/hooks/useOrgSelectors", () => ({
  usePrimaryOrgWithMembership: () => usePrimaryOrgWithMembershipMock(),
}));

jest.mock("@/app/hooks/useAvailabiities", () => ({
  usePrimaryAvailability: () => usePrimaryAvailabilityMock(),
}));

jest.mock("@/app/hooks/useProfiles", () => ({
  usePrimaryOrgProfile: () => usePrimaryOrgProfileMock(),
}));

const upsertAvailabilityMock = jest.fn();

jest.mock("@/app/services/availability", () => ({
  upsertAvailability: (...args: any[]) => upsertAvailabilityMock(...args),
}));

jest.mock("@/app/components/Availability/utils", () => ({
  ...jest.requireActual("@/app/components/Availability/utils"),
  convertAvailability: jest.fn(),
  hasAtLeastOneAvailability: jest.fn(),
}));

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock("@/app/pages/Organization/Sections/ProfileCard", () => ({
  __esModule: true,
  default: ({ title }: any) => <div>{title}</div>,
}));

jest.mock("@/app/components/Availability/Availability", () => ({
  __esModule: true,
  default: () => <div>Availability Editor</div>,
}));

const buildAvailability = () =>
  availabilityUtils.daysOfWeek.reduce((acc, day) => {
    acc[day] = {
      enabled: day === "Monday",
      intervals: [{ ...availabilityUtils.DEFAULT_INTERVAL }],
    };
    return acc;
  }, {} as availabilityUtils.AvailabilityState);

describe("Settings OrgSection", () => {
  beforeEach(() => {
    usePrimaryAvailabilityMock.mockReturnValue({
      availabilities: buildAvailability(),
    });
    usePrimaryOrgProfileMock.mockReturnValue({
      personalDetails: {
        employmentType: "Full-time",
        gender: "male",
        dateOfBirth: "2024-01-01",
        phoneNumber: "123",
        address: { country: "USA" },
      },
      professionalDetails: {},
    });
  });

  it("renders nothing without org", () => {
    usePrimaryOrgWithMembershipMock.mockReturnValue({ org: null, membership: null });

    const { container } = render(<OrgSection />);
    expect(container).toBeEmptyDOMElement();
  });

  it("saves availability", () => {
    usePrimaryOrgWithMembershipMock.mockReturnValue({
      org: { name: "Clinic" },
      membership: { roleDisplay: "Admin" },
    });

    (availabilityUtils.convertAvailability as jest.Mock).mockReturnValue([
      { day: "Monday", intervals: [] },
    ]);
    (availabilityUtils.hasAtLeastOneAvailability as jest.Mock).mockReturnValue(
      true
    );

    render(<OrgSection />);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(upsertAvailabilityMock).toHaveBeenCalled();
  });
});
