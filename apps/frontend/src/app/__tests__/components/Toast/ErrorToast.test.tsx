import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import ErrorToast from "@/app/ui/widgets/Toast/ErrorToast";

jest.mock("@/app/ui/primitives/Icons", () => ({
  Close: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      Close
    </button>
  ),
}));

jest.mock("react-icons/md", () => ({
  MdError: () => <span data-testid="error-icon" />,
}));

describe("ErrorToast", () => {
  it("renders title and text and invokes closeToast", () => {
    const closeToast = jest.fn();

    render(
      <ErrorToast
        data={{ title: "Error title", text: "Something broke" }}
        closeToast={closeToast}
        isPaused={false}
        toastProps={{} as any}
      />
    );

    expect(screen.getByText("Error title")).toBeInTheDocument();
    expect(screen.getByText("Something broke")).toBeInTheDocument();
    expect(screen.getByTestId("error-icon")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Close"));
    expect(closeToast).toHaveBeenCalledTimes(1);
  });
});
