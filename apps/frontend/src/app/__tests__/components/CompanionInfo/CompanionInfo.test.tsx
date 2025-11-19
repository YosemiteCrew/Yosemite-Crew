import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import "../../../jest.mocks/testMocks";
import type { CompanionProps } from "@/app/pages/Companions/types";

const modalCloseMock = jest.fn();
const labelsRenderMock = jest.fn();

jest.mock("@/app/components/Modal", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="modal-mock">{children}</div>
  ),
}));

jest.mock("react-icons/io", () => ({
  IoIosCloseCircleOutline: ({ onClick }: { onClick?: () => void }) => (
    <button
      type="button"
      data-testid={onClick ? "close-icon" : "placeholder-icon"}
      onClick={onClick}
    >
      close
    </button>
  ),
}));

jest.mock("@/app/components/Labels/Labels", () => ({
  __esModule: true,
  default: (props: any) => {
    labelsRenderMock(props);
    const active =
      props.labels.find((label: any) => label.key === props.activeLabel) ||
      props.labels[0];
    return (
      <div>
        {props.labels.map((label: any) => (
          <button
            key={label.key}
            data-testid={`label-${label.key}`}
            onClick={() => props.setActiveLabel(label.key)}
          >
            {label.name}
          </button>
        ))}
        {active.labels.map((sub: any) => (
          <button
            key={sub.key}
            data-testid={`sublabel-${sub.key}`}
            onClick={() => props.setActiveSubLabel(sub.key)}
          >
            {sub.name}
          </button>
        ))}
      </div>
    );
  },
}));

function createSection(name: string) {
  return ({ companion }: { companion: CompanionProps | null }) => (
    <div data-testid={`section-${name}`}>{companion?.name ?? "no-data"}</div>
  );
}

jest.mock("@/app/components/CompanionInfo/Sections", () => ({
  __esModule: true,
  Companion: createSection("companion-information"),
  Parent: createSection("parent-information"),
  Core: createSection("core-information"),
  History: createSection("history"),
  Documents: createSection("documents"),
  AddAppointment: createSection("add-appointment"),
  AddTask: createSection("add-task"),
}));

import CompanionInfo from "@/app/components/CompanionInfo";

const companion: CompanionProps = {
  image: "/pet.png",
  name: "Snow",
  breed: "Husky",
  species: "Dog",
  parent: "Max",
  gender: "Female",
  age: "2y",
  lastMedication: "None",
  vaccineDue: "2025-02-01",
  upcomingAppointent: "2025-02-05",
  upcomingAppointentTime: "10:00",
  status: "Active",
};

describe("<CompanionInfo />", () => {
  beforeEach(() => {
    labelsRenderMock.mockClear();
    modalCloseMock.mockClear();
  });

  test("renders companion data and default section", () => {
    render(
      <CompanionInfo
        showModal
        setShowModal={modalCloseMock}
        activeCompanion={companion}
      />
    );

     expect(screen.getAllByText("Snow").length).toBeGreaterThan(0);
    expect(screen.getByText("Husky / Dog")).toBeInTheDocument();
    expect(
      screen.getByTestId("section-companion-information")
    ).toHaveTextContent("Snow");
  });

  test("switching labels updates rendered section", async () => {
    render(
      <CompanionInfo
        showModal
        setShowModal={modalCloseMock}
        activeCompanion={companion}
      />
    );

    fireEvent.click(screen.getByTestId("label-records"));
    await waitFor(() =>
      expect(screen.getByTestId("section-history")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId("sublabel-documents"));
    expect(screen.getByTestId("section-documents")).toHaveTextContent("Snow");
  });

  test("close icon toggles modal visibility", () => {
    render(
      <CompanionInfo
        showModal
        setShowModal={modalCloseMock}
        activeCompanion={companion}
      />
    );

    fireEvent.click(screen.getByTestId("close-icon"));
    expect(modalCloseMock).toHaveBeenCalledWith(false);
  });
});
