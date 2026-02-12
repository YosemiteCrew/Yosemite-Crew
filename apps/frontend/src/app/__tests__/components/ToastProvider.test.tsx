import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import ToastProvider from "@/app/ui/layout/ToastProvider";

let toastContainerProps: any;

jest.mock("react-toastify", () => ({
  Slide: jest.fn(),
  ToastContainer: (props: any) => {
    toastContainerProps = props;
    return <div data-testid="toast-container" />;
  },
}));

describe("ToastProvider", () => {
  beforeEach(() => {
    toastContainerProps = undefined;
  });

  it("renders ToastContainer with configured props", () => {
    render(<ToastProvider />);

    expect(screen.getByTestId("toast-container")).toBeInTheDocument();
    expect(toastContainerProps).toEqual(
      expect.objectContaining({
        limit: 5,
      })
    );
    expect(toastContainerProps.transition).toBeDefined();
  });
});
