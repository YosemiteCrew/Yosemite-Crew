/* eslint-disable @next/next/no-img-element */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import ProfileCard from "@/app/features/organization/pages/Organization/Sections/ProfileCard";

jest.mock("@/app/ui/primitives/Buttons", () => ({
  Primary: ({ text }: any) => <div>{text}</div>,
  Secondary: ({ text }: any) => <div>{text}</div>,
}));

jest.mock("@/app/ui/inputs/Datepicker", () => ({
  __esModule: true,
  default: ({ placeholder }: any) => <input placeholder={placeholder} />,
}));

jest.mock("@/app/ui/inputs/Dropdown/LabelDropdown", () => ({
  __esModule: true,
  default: ({ placeholder }: any) => <div>{placeholder}</div>,
}));

jest.mock("@/app/ui/inputs/FormInput/FormInput", () => ({
  __esModule: true,
  default: ({ inlabel }: any) => <div>{inlabel}</div>,
}));

jest.mock("@/app/ui/inputs/MultiSelectDropdown", () => ({
  __esModule: true,
  default: ({ placeholder }: any) => <div>{placeholder}</div>,
}));

jest.mock("@/app/hooks/useProfiles", () => ({
  usePrimaryOrgProfile: () => ({ personalDetails: { profilePictureUrl: "" } }),
}));

jest.mock("@/app/stores/authStore", () => ({
  useAuthStore: (selector: any) =>
    selector({ attributes: { given_name: "Pat", family_name: "Kim" } }),
}));

jest.mock("@/app/lib/urls", () => ({
  isHttpsImageUrl: () => false,
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img alt={props.alt} {...props} />,
}));

describe("Organization ProfileCard", () => {
  it("renders field values in view mode", () => {
    render(
      <ProfileCard
        title="Test Card"
        editable={false}
        fields={[
          { label: "Name", key: "name", type: "text" },
          {
            label: "Role",
            key: "role",
            type: "select",
            options: [{ label: "Admin", value: "admin" }],
          },
        ]}
        org={{ name: "Acme", role: "admin" }}
      />
    );

    expect(screen.getByText("Test Card")).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });
});
