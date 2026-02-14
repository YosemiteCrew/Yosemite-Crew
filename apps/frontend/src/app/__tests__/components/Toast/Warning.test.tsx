import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import Warning from "@/app/ui/widgets/Toast/Warning";

jest.mock("@/app/ui/primitives/Icons", () => ({
  Close: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      Close
    </button>
  ),
}));

jest.mock("react-icons/io", () => ({
  IoIosWarning: () => <span data-testid="warning-icon" />,
}));

describe("Warning", () => {
  it("renders title and text and invokes closeToast", () => {
    const closeToast = jest.fn();

    render(
      <Warning
        data={{ title: "Warning title", text: "Be careful" }}
        closeToast={closeToast}
        isPaused={false}
        toastProps={{} as any}
      />
    );

    expect(screen.getByText("Warning title")).toBeInTheDocument();
    expect(screen.getByText("Be careful")).toBeInTheDocument();
    expect(screen.getByTestId("warning-icon")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Close"));
    expect(closeToast).toHaveBeenCalledTimes(1);
  });
});
