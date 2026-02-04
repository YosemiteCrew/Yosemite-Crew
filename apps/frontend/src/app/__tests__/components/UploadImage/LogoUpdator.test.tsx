/* eslint-disable @next/next/no-img-element */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import LogoUpdator from "@/app/ui/widgets/UploadImage/LogoUpdator";

jest.mock("@/app/ui/overlays/Modal/CenterModal", () => ({
  __esModule: true,
  default: ({ showModal, children }: any) =>
    showModal ? <div data-testid="modal">{children}</div> : null,
}));

jest.mock("@/app/ui/primitives/Buttons", () => ({
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

jest.mock("@/app/lib/urls", () => ({
  isHttpsImageUrl: () => false,
}));

jest.mock("@/app/services/axios", () => ({
  postData: jest.fn(),
}));

jest.mock("axios", () => ({
  put: jest.fn(),
}));

jest.mock("react-icons/md", () => ({
  MdArrowRightAlt: () => <span>arrow</span>,
}));

jest.mock("react-icons/io5", () => ({
  IoCamera: () => <span>camera</span>,
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img alt={props.alt} {...props} />,
}));

describe("LogoUpdator", () => {
  it("shows validation error when update without file", () => {
    render(
      <LogoUpdator
        title="Update Logo"
        apiUrl="/api/logo"
        onSave={jest.fn()}
        imageUrl="https://d2il6osz49gpup.cloudfront.net/avatar/business1.png"
      />
    );

    fireEvent.click(screen.getAllByAltText("Logo")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Update" }));

    expect(
      screen.getByText("Please choose an image to upload.")
    ).toBeInTheDocument();
  });
});
