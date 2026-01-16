import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import AddForm from "@/app/pages/Forms/Sections/AddForm";

jest.mock("@/app/components/Modal", () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="modal">{children}</div>,
}));

jest.mock("@/app/components/Icons/Close", () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      Close
    </button>
  ),
}));

jest.mock("@/app/components/Labels/SubLabels", () => ({
  __esModule: true,
  default: ({ labels, setActiveLabel }: any) => (
    <div>
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

jest.mock("@/app/pages/Forms/Sections/AddForm/Details", () => ({
  __esModule: true,
  default: ({ onNext, registerValidator }: any) => {
    registerValidator(() => true);
    return (
      <div>
        <div>Details Step</div>
        <button type="button" onClick={onNext}>
          Next Details
        </button>
      </div>
    );
  },
}));

jest.mock("@/app/pages/Forms/Sections/AddForm/Build", () => ({
  __esModule: true,
  default: ({ onNext, registerValidator }: any) => {
    registerValidator(() => true);
    return (
      <div>
        <div>Build Step</div>
        <button type="button" onClick={onNext}>
          Next Build
        </button>
      </div>
    );
  },
}));

jest.mock("@/app/pages/Forms/Sections/AddForm/Review", () => ({
  __esModule: true,
  default: ({ onPublish, onSaveDraft }: any) => (
    <div>
      <div>Review Step</div>
      <button type="button" onClick={onPublish}>
        Publish
      </button>
      <button type="button" onClick={onSaveDraft}>
        Save Draft
      </button>
    </div>
  ),
}));

jest.mock("@/app/services/formService", () => ({
  saveFormDraft: jest.fn(),
  publishForm: jest.fn(),
}));

const formService = jest.requireMock("@/app/services/formService");

describe("AddForm modal", () => {
  const serviceOptions = [{ label: "Checkup", value: "serv-1" }];

  beforeEach(() => {
    jest.clearAllMocks();
    formService.saveFormDraft.mockResolvedValue({ _id: "form-1" });
    formService.publishForm.mockResolvedValue(undefined);
  });

  it("navigates through steps and publishes", async () => {
    render(
      <AddForm
        showModal
        setShowModal={jest.fn()}
        serviceOptions={serviceOptions}
      />
    );

    expect(screen.getByText("Details Step")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Next Details"));
    expect(screen.getByText("Build Step")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Next Build"));
    expect(screen.getByText("Review Step")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Publish"));

    await waitFor(() => {
      expect(formService.saveFormDraft).toHaveBeenCalled();
      expect(formService.publishForm).toHaveBeenCalledWith("form-1");
    });
  });

  it("saves a draft from review", async () => {
    render(
      <AddForm
        showModal
        setShowModal={jest.fn()}
        serviceOptions={serviceOptions}
      />
    );

    fireEvent.click(screen.getByText("Next Details"));
    fireEvent.click(screen.getByText("Next Build"));
    fireEvent.click(screen.getByText("Save Draft"));

    await waitFor(() => {
      expect(formService.saveFormDraft).toHaveBeenCalled();
    });
  });
});
