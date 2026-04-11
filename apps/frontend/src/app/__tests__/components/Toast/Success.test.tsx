import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import Success from "@/app/ui/widgets/Toast/Success";

jest.mock("@/app/ui/primitives/Icons", () => ({
  Close: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      Close
    </button>
  ),
}));

jest.mock("react-icons/fa6", () => ({
  FaCircleCheck: () => <span data-testid="success-icon" />,
}));

describe("Success", () => {
  it("renders title and text and invokes closeToast", () => {
    const closeToast = jest.fn();

    render(
      <Success
        data={{ title: "Success title", text: "All done" }}
        closeToast={closeToast}
        isPaused={false}
        toastProps={{} as any}
      />
    );

    expect(screen.getByText("Success title")).toBeInTheDocument();
    expect(screen.getByText("All done")).toBeInTheDocument();
    expect(screen.getByTestId("success-icon")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Close"));
    expect(closeToast).toHaveBeenCalledTimes(1);
  });
});
