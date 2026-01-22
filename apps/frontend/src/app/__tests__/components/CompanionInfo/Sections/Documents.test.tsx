import React from "react";
import { act, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import Documents from "@/app/components/CompanionInfo/Sections/Documents";

const accordionSpy = jest.fn();
const labelDropdownProps: any[] = [];

jest.mock("@/app/components/PermissionGate", () => ({
  PermissionGate: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("@/app/components/Accordion/Accordion", () => (props: any) => {
  accordionSpy(props);
  return (
    <div>
      <div>{props.title}</div>
      <div>{props.children}</div>
    </div>
  );
});

jest.mock("@/app/components/Inputs/Dropdown/LabelDropdown", () => (props: any) => {
  labelDropdownProps.push(props);
  return <div data-testid={`dropdown-${props.placeholder}`} />;
});

jest.mock("@/app/components/Inputs/FormInput/FormInput", () => (props: any) => (
  <input aria-label={props.inlabel} />
));

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text }: any) => <button type="button">{text}</button>,
}));

describe("Companion Documents section", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    labelDropdownProps.length = 0;
  });

  it("renders document categories and upload controls", () => {
    render(<Documents />);

    expect(screen.getByText("Health")).toBeInTheDocument();
    expect(screen.getByText("Hygiene maintenance")).toBeInTheDocument();
    expect(screen.getByText("Upload records")).toBeInTheDocument();
    expect(screen.getByLabelText("Breed")).toBeInTheDocument();
    expect(screen.getByText("Save")).toBeInTheDocument();

    const categoryProps = labelDropdownProps.find(
      (props) => props.placeholder === "Category"
    );
    const subProps = labelDropdownProps.find(
      (props) => props.placeholder === "Sub-category"
    );

    expect(categoryProps.options).toHaveLength(2);
    expect(subProps.options).toHaveLength(0);
  });

  it("updates sub-category options when category is selected", () => {
    render(<Documents />);

    const getLatestProps = (placeholder: string) => {
      const matches = labelDropdownProps.filter(
        (props) => props.placeholder === placeholder
      );
      return matches[matches.length - 1];
    };

    act(() => {
      getLatestProps("Category").onSelect({ value: "Health" });
    });

    const subProps = getLatestProps("Sub-category");
    expect(subProps.options.length).toBeGreaterThan(0);
  });
});
