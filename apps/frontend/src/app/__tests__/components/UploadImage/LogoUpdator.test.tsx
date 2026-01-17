/* eslint-disable @next/next/no-img-element */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import LogoUpdator from "@/app/components/UploadImage/LogoUpdator";

jest.mock("@/app/components/Modal/CenterModal", () => ({
  __esModule: true,
  default: ({ showModal, children }: any) =>
    showModal ? <div data-testid="modal">{children}</div> : null,
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

jest.mock("@/app/utils/urls", () => ({
  isHttpsImageUrl: () => false,
}));

jest.mock("@/app/services/axios", () => ({
  postData: jest.fn(),
}));

jest.mock("axios", () => ({
  put: jest.fn(),
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img alt={props.alt} {...props} />,
}));

jest.mock("react-icons/md", () => ({
  MdArrowRightAlt: () => <span>arrow</span>,
}));

jest.mock("react-icons/io5", () => ({
  IoCamera: () => <span>camera</span>,
}));

describe("LogoUpdator", () => {
  it("shows error when updating without file", () => {
    render(
      <LogoUpdator
        title="Update Logo"
        apiUrl="/api/logo"
        onSave={jest.fn()}
      />
    );

    fireEvent.click(screen.getAllByAltText("Logo")[0]);
    expect(screen.getByTestId("modal")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    expect(
      screen.getByText("Please choose an image to upload.")
    ).toBeInTheDocument();
  });
});
