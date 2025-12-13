import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("@/app/components/Modal", () => ({
  __esModule: true,
  default: ({ children, showModal }: any) => (
    <div data-testid="modal" data-open={showModal}>
      {children}
    </div>
  ),
}));

jest.mock("@/app/components/Labels/SubLabels", () => ({
  __esModule: true,
  default: ({ labels, activeLabel, setActiveLabel }: any) => (
    <div data-testid="sub-labels">
      <div data-testid="active-label">{activeLabel}</div>
      {labels.map((label: any) => (
        <button
          key={label.key}
          type="button"
          onClick={() => setActiveLabel(label.key)}
        >
          {label.name}
        </button>
      ))}
    </div>
  ),
}));

const formSectionRender = jest.fn();
jest.mock("@/app/components/AddInventory/FormSection", () => ({
  __esModule: true,
  default: (props: any) => {
    formSectionRender(props);
    const { sectionKey, errors, onFieldChange, onSave } = props;
    return (
      <div data-testid="form-section" data-section={sectionKey}>
        <div data-testid="errors">{JSON.stringify(errors)}</div>
        <button
          type="button"
          onClick={() => onFieldChange(sectionKey, "name", "Inventory Name")}
        >
          set-name
        </button>
        <button
          type="button"
          onClick={() => onFieldChange(sectionKey, "category", "Category A")}
        >
          set-category
        </button>
        <button type="button" onClick={onSave}>
          save-section
        </button>
      </div>
    );
  },
}));

import AddInventory from "@/app/components/AddInventory";

describe("<AddInventory />", () => {
  test("switches between sections via sub labels", () => {
    render(
      <AddInventory
        showModal={true}
        setShowModal={jest.fn()}
        businessType="HOSPITAL"
        onSubmit={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByTestId("modal")).toHaveAttribute("data-open", "true");
    expect(screen.getByTestId("form-section")).toHaveAttribute(
      "data-section",
      "basicInfo",
    );

    fireEvent.click(screen.getByText("Classification attribute"));
    expect(screen.getByTestId("form-section")).toHaveAttribute(
      "data-section",
      "classification",
    );
  });

  test("validates required fields before saving", () => {
    render(
      <AddInventory
        showModal={false}
        setShowModal={jest.fn()}
        businessType="GROOMER"
        onSubmit={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.click(screen.getByText("save-section"));
    expect(screen.getByTestId("errors").textContent).toMatch("Name is required");
    expect(screen.getByTestId("errors").textContent).toMatch(
      "Category is required",
    );

    fireEvent.click(screen.getByText("set-name"));
    fireEvent.click(screen.getByText("set-category"));
    fireEvent.click(screen.getByText("save-section"));

    expect(screen.getByTestId("errors").textContent).toBe("{}");
  });
});
