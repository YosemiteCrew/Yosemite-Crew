import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import Info from "@/app/ui/widgets/Toast/Info";

jest.mock("@/app/ui/primitives/Icons", () => ({
  Close: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      Close
    </button>
  ),
}));

jest.mock("react-icons/io", () => ({
  IoIosInformationCircle: () => <span data-testid="info-icon" />,
}));

describe("Info", () => {
  it("renders title and text and invokes closeToast", () => {
    const closeToast = jest.fn();

    render(
      <Info
        data={{ title: "Info title", text: "Details" }}
        closeToast={closeToast}
        isPaused={false}
        toastProps={{} as any}
      />
    );

    expect(screen.getByText("Info title")).toBeInTheDocument();
    expect(screen.getByText("Details")).toBeInTheDocument();
    expect(screen.getByTestId("info-icon")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Close"));
    expect(closeToast).toHaveBeenCalledTimes(1);
  });
});
