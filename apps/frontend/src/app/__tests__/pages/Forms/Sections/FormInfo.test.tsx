import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import FormInfo from "@/app/pages/Forms/Sections/FormInfo";

const publishFormMock = jest.fn();

jest.mock("@/app/services/formService", () => ({
  archiveForm: jest.fn(),
  publishForm: (...args: any[]) => publishFormMock(...args),
  unpublishForm: jest.fn(),
}));

jest.mock("@/app/components/Toast/Toast", () => ({
  useErrorTost: () => ({
    showErrorTost: jest.fn(),
    ErrorTostPopup: () => <div>toast</div>,
  }),
}));

jest.mock("@/app/components/Modal", () => ({
  __esModule: true,
  default: ({ showModal, children }: any) =>
    showModal ? <div data-testid="modal">{children}</div> : null,
}));

jest.mock("@/app/components/Icons/Close", () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      close
    </button>
  ),
}));

jest.mock("@/app/components/Accordion/EditableAccordion", () => ({
  __esModule: true,
  default: ({ title }: any) => <div>{title}</div>,
}));

jest.mock("@/app/components/Accordion/Accordion", () => ({
  __esModule: true,
  default: ({ title }: any) => <div>{title}</div>,
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

jest.mock("@/app/pages/Forms/Sections/AddForm/components/FormRenderer", () => ({
  __esModule: true,
  default: () => <div>form-renderer</div>,
}));

jest.mock("@iconify/react", () => ({
  Icon: () => <span>icon</span>,
}));

describe("FormInfo", () => {
  beforeAll(() => {
    if ((console.error as jest.Mock).mockImplementation) {
      (console.error as jest.Mock).mockImplementation(() => {});
    } else {
      jest.spyOn(console, "error").mockImplementation(() => {});
    }
  });

  afterAll(() => {
    (console.error as jest.Mock).mockRestore?.();
  });

  it("publishes draft form", async () => {
    const setShowModal = jest.fn();
    publishFormMock.mockResolvedValue(undefined);

    render(
      <FormInfo
        showModal
        setShowModal={setShowModal}
        activeForm={{
          _id: "f1",
          name: "Form",
          status: "Draft",
          fields: [],
        } as any}
        onEdit={jest.fn()}
        serviceOptions={[]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Publish" }));

    await waitFor(() => {
      expect(publishFormMock).toHaveBeenCalledWith("f1");
    });
    expect(setShowModal).toHaveBeenCalledWith(false);
  });
});
