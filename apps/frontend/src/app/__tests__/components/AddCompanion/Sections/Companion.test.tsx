import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import Companion from "@/app/components/AddCompanion/Sections/Companion";
import {
  EMPTY_STORED_COMPANION,
  EMPTY_STORED_PARENT,
} from "@/app/components/AddCompanion/type";
import { StoredCompanion, StoredParent } from "@/app/pages/Companions/types";

jest.mock("@/app/components/Accordion/Accordion", () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
}));

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
  Secondary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock("@/app/components/Inputs/Datepicker", () => ({
  __esModule: true,
  default: ({ placeholder, setCurrentDate }: any) => (
    <button type="button" onClick={() => setCurrentDate(new Date("2020-01-01"))}>
      {placeholder}
    </button>
  ),
}));

jest.mock("@/app/components/Inputs/Dropdown/LabelDropdown", () => ({
  __esModule: true,
  default: ({ placeholder, options = [], onSelect, error }: any) => (
    <div>
      <span>{placeholder}</span>
      <button
        type="button"
        onClick={() => options[0] && onSelect(options[0])}
      >
        Select
      </button>
      {error ? <span>{error}</span> : null}
    </div>
  ),
}));

jest.mock("@/app/components/Inputs/FormDesc/FormDesc", () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange }: any) => (
    <label>
      {inlabel}
      <textarea
        aria-label={inlabel}
        value={value ?? ""}
        onChange={onChange}
      />
    </label>
  ),
}));

jest.mock("@/app/components/Inputs/FormInput/FormInput", () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange, error }: any) => (
    <label>
      {inlabel}
      <input
        aria-label={inlabel}
        value={value ?? ""}
        onChange={onChange}
      />
      {error ? <span>{error}</span> : null}
    </label>
  ),
}));

jest.mock("@/app/components/Inputs/SearchDropdown", () => ({
  __esModule: true,
  default: ({ placeholder, options = [], query, setQuery, onSelect }: any) => (
    <div>
      <input
        placeholder={placeholder}
        value={query ?? ""}
        onChange={(event) => setQuery(event.target.value)}
      />
      {options.map((option: any) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onSelect(option.key)}
        >
          {option.value}
        </button>
      ))}
    </div>
  ),
}));

jest.mock("@/app/components/Inputs/SelectLabel", () => ({
  __esModule: true,
  default: ({ title, options = [], setOption }: any) => (
    <div>
      <span>{title}</span>
      {options.map((option: any) => (
        <button
          key={option.key}
          type="button"
          onClick={() => setOption(option.key)}
        >
          {option.name ?? option.label}
        </button>
      ))}
    </div>
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

import {
  createCompanion,
  createParent,
  getCompanionForParent,
  linkCompanion,
} from "@/app/services/companionService";

const baseParent: StoredParent = {
  ...EMPTY_STORED_PARENT,
  address: {
    ...EMPTY_STORED_PARENT.address,
  },
};

const buildCompanion = (overrides: Partial<StoredCompanion>) =>
  ({
    ...EMPTY_STORED_COMPANION,
    ...overrides,
  }) as StoredCompanion;

describe("<Companion />", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getCompanionForParent as jest.Mock).mockResolvedValue([]);
  });

  it("shows required field errors when missing", () => {
    const formData = buildCompanion({
      name: "",
      type: undefined,
      breed: "",
      dateOfBirth: undefined as unknown as Date,
    });

    render(
      <Companion
        formData={formData}
        setFormData={jest.fn()}
        parentFormData={baseParent}
        setParentFormData={jest.fn()}
        setActiveLabel={jest.fn()}
        setShowModal={jest.fn()}
      />
    );

    fireEvent.click(screen.getByText("Save"));

    expect(screen.getByText("Name is required")).toBeInTheDocument();
    expect(screen.getByText("Species is required")).toBeInTheDocument();
    expect(screen.getByText("Breed is required")).toBeInTheDocument();
    expect(screen.getByText("Date of birth is required")).toBeInTheDocument();
  });

  it("links an existing companion for an existing parent", async () => {
    const setShowModal = jest.fn();
    const setActiveLabel = jest.fn();
    const setFormData = jest.fn();
    const setParentFormData = jest.fn();

    const parentFormData: StoredParent = {
      ...baseParent,
      id: "parent-1",
    };
    const formData = buildCompanion({
      id: "companion-1",
      name: "Rex",
      type: "dog",
      breed: "1",
      dateOfBirth: new Date("2020-01-01"),
    });

    render(
      <Companion
        formData={formData}
        setFormData={setFormData}
        parentFormData={parentFormData}
        setParentFormData={setParentFormData}
        setActiveLabel={setActiveLabel}
        setShowModal={setShowModal}
      />
    );

    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(linkCompanion).toHaveBeenCalled();
    });

    expect(linkCompanion).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "companion-1",
        parentId: "parent-1",
      }),
      parentFormData
    );
    expect(createCompanion).not.toHaveBeenCalled();
    expect(createParent).not.toHaveBeenCalled();
    expect(setShowModal).toHaveBeenCalledWith(false);
    expect(setActiveLabel).toHaveBeenCalledWith("parents");
    expect(setFormData).toHaveBeenCalledWith(EMPTY_STORED_COMPANION);
    expect(setParentFormData).toHaveBeenCalledWith(EMPTY_STORED_PARENT);
  });
});
