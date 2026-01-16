import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import FormInfo from "@/app/pages/Forms/Sections/FormInfo";

jest.mock("@/app/components/Modal", () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="modal">{children}</div>,
}));

jest.mock("@/app/components/Accordion/EditableAccordion", () => ({
  __esModule: true,
  default: ({ title }: any) => <div>{title}</div>,
}));

jest.mock("@/app/components/Accordion/Accordion", () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div>
      <div>{title}</div>
      <div>{children}</div>
    </div>
  ),
}));

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, onClick, isDisabled }: any) => (
    <button type="button" onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
  Secondary: ({ text, onClick, isDisabled }: any) => (
    <button type="button" onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
}));

jest.mock("@/app/components/Icons/Close", () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      Close
    </button>
  ),
}));

jest.mock("@/app/pages/Forms/Sections/AddForm/components/FormRenderer", () => ({
  __esModule: true,
  default: () => <div>Form Renderer</div>,
}));

jest.mock("@/app/services/formService", () => ({
  publishForm: jest.fn(),
  unpublishForm: jest.fn(),
  archiveForm: jest.fn(),
}));

const formService = jest.requireMock("@/app/services/formService");

describe("FormInfo", () => {
  const serviceOptions = [{ label: "Checkup", value: "serv-1" }];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders actions for published forms", async () => {
    formService.unpublishForm.mockResolvedValue(undefined);
    formService.archiveForm.mockResolvedValue(undefined);

    render(
      <FormInfo
        showModal
        setShowModal={jest.fn()}
        activeForm={{
          _id: "form-1",
          name: "Intake",
          status: "Published",
          schema: [{ id: "q1", type: "text" }],
        } as any}
        onEdit={jest.fn()}
        serviceOptions={serviceOptions}
      />
    );

    expect(screen.getByText("Form details")).toBeInTheDocument();
    expect(screen.getByText("Form preview")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Unpublish"));
    await waitFor(() => {
      expect(formService.unpublishForm).toHaveBeenCalledWith("form-1");
    });

    fireEvent.click(screen.getByText("Archive"));
    await waitFor(() => {
      expect(formService.archiveForm).toHaveBeenCalledWith("form-1");
    });
  });

  it("publishes draft and handles edit", async () => {
    formService.publishForm.mockResolvedValue(undefined);
    const onEdit = jest.fn();

    render(
      <FormInfo
        showModal
        setShowModal={jest.fn()}
        activeForm={{
          _id: "form-2",
          name: "Consent",
          status: "Draft",
          schema: [],
        } as any}
        onEdit={onEdit}
        serviceOptions={serviceOptions}
      />
    );

    fireEvent.click(screen.getByText("Publish"));
    await waitFor(() => {
      expect(formService.publishForm).toHaveBeenCalledWith("form-2");
    });

    fireEvent.click(screen.getByText("Edit form"));
    expect(onEdit).toHaveBeenCalled();
  });
});
