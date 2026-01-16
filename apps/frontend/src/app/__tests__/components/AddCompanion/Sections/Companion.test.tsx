import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import Companion from "@/app/components/AddCompanion/Sections/Companion";
import {
  EMPTY_STORED_COMPANION,
  EMPTY_STORED_PARENT,
} from "@/app/components/AddCompanion/type";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, onClick, ...props }: any) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

jest.mock("@iconify/react/dist/iconify.js", () => ({
  Icon: () => <span data-testid="icon" />,
}));

jest.mock("@/app/services/companionService", () => ({
  createCompanion: jest.fn(),
  createParent: jest.fn(),
  getCompanionForParent: jest.fn(),
  linkCompanion: jest.fn(),
}));

jest.mock("@/app/components/Inputs/SearchDropdown", () => ({
  __esModule: true,
  default: ({ placeholder, query, setQuery }: any) => (
    <label>
      {placeholder}
      <input
        aria-label={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
    </label>
  ),
}));

jest.mock("@/app/components/Inputs/Datepicker", () => ({
  __esModule: true,
  default: ({ placeholder }: any) => (
    <button type="button">{placeholder}</button>
  ),
}));

const companionService = jest.requireMock("@/app/services/companionService");

describe("AddCompanion Companion section", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    companionService.getCompanionForParent.mockResolvedValue([]);
    companionService.createParent.mockResolvedValue("parent-1");
  });

  it("shows validation errors when required fields are missing", async () => {
    render(
      <Companion
        setActiveLabel={jest.fn()}
        formData={{
          ...EMPTY_STORED_COMPANION,
          name: "",
          type: "" as any,
          breed: "",
          dateOfBirth: undefined as any,
        }}
        setFormData={jest.fn()}
        parentFormData={{ ...EMPTY_STORED_PARENT, id: "parent-1" }}
        setParentFormData={jest.fn()}
        setShowModal={jest.fn()}
      />
    );

    fireEvent.click(screen.getByText("Save"));

    expect(await screen.findByText("Name is required")).toBeInTheDocument();
    expect(screen.getByText("Species is required")).toBeInTheDocument();
    expect(screen.getByText("Breed is required")).toBeInTheDocument();
    expect(
      screen.getByText("Date of birth is required")
    ).toBeInTheDocument();

    expect(companionService.createCompanion).not.toHaveBeenCalled();
    expect(companionService.linkCompanion).not.toHaveBeenCalled();
  });

  it("creates a new companion for an existing parent", async () => {
    const setShowModal = jest.fn();
    const setActiveLabel = jest.fn();
    const setFormData = jest.fn();
    const setParentFormData = jest.fn();

    companionService.createCompanion.mockResolvedValue(undefined);

    render(
      <Companion
        setActiveLabel={setActiveLabel}
        formData={{
          ...EMPTY_STORED_COMPANION,
          id: "",
          name: "Buddy",
          type: "dog" as any,
          breed: "husky",
          dateOfBirth: new Date("2020-01-01"),
        }}
        setFormData={setFormData}
        parentFormData={{ ...EMPTY_STORED_PARENT, id: "parent-1" }}
        setParentFormData={setParentFormData}
        setShowModal={setShowModal}
      />
    );

    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(companionService.createCompanion).toHaveBeenCalled();
    });

    expect(companionService.linkCompanion).not.toHaveBeenCalled();
    expect(setShowModal).toHaveBeenCalledWith(false);
    expect(setFormData).toHaveBeenCalledWith(EMPTY_STORED_COMPANION);
    expect(setParentFormData).toHaveBeenCalledWith(EMPTY_STORED_PARENT);
    expect(setActiveLabel).toHaveBeenCalledWith("parents");
  });

  it("links an existing companion for the parent", async () => {
    companionService.linkCompanion.mockResolvedValue(undefined);

    render(
      <Companion
        setActiveLabel={jest.fn()}
        formData={{
          ...EMPTY_STORED_COMPANION,
          id: "comp-1",
          name: "Buddy",
          type: "dog" as any,
          breed: "husky",
          dateOfBirth: new Date("2020-01-01"),
        }}
        setFormData={jest.fn()}
        parentFormData={{ ...EMPTY_STORED_PARENT, id: "parent-1" }}
        setParentFormData={jest.fn()}
        setShowModal={jest.fn()}
      />
    );

    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(companionService.linkCompanion).toHaveBeenCalled();
    });
    expect(companionService.createCompanion).not.toHaveBeenCalled();
  });

  it("creates a parent before creating a companion when parent is missing", async () => {
    companionService.createCompanion.mockResolvedValue(undefined);

    render(
      <Companion
        setActiveLabel={jest.fn()}
        formData={{
          ...EMPTY_STORED_COMPANION,
          id: "",
          name: "Buddy",
          type: "dog" as any,
          breed: "husky",
          dateOfBirth: new Date("2020-01-01"),
        }}
        setFormData={jest.fn()}
        parentFormData={{ ...EMPTY_STORED_PARENT, id: "" }}
        setParentFormData={jest.fn()}
        setShowModal={jest.fn()}
      />
    );

    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(companionService.createParent).toHaveBeenCalled();
    });
    expect(companionService.createCompanion).toHaveBeenCalled();
  });
});
