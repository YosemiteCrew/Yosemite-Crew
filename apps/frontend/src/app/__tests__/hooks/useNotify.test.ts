import { renderHook } from "@testing-library/react";
import { toast } from "react-toastify";
import { useNotify } from "@/app/hooks/useNotify";
import Success from "@/app/ui/widgets/Toast/Success";
import ErrorToast from "@/app/ui/widgets/Toast/ErrorToast";

jest.mock("react-toastify", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
  },
}));

describe("useNotify", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("routes success notifications to toast.success with base options", () => {
    const { result } = renderHook(() => useNotify());

    const data = { title: "Saved", text: "Appointment updated" };

    result.current.notify("success", data);

    expect(toast.success).toHaveBeenCalledWith(
      Success,
      expect.objectContaining({
        data,
        closeButton: false,
        icon: false,
        hideProgressBar: true,
        className: expect.stringContaining("w-[400px]"),
      })
    );
  });

  it("merges overrides when showing an error toast", () => {
    const { result } = renderHook(() => useNotify());

    const data = { title: "Error", text: "Something went wrong" };

    result.current.notify("error", data, { autoClose: 1200 });

    expect(toast.error).toHaveBeenCalledWith(
      ErrorToast,
      expect.objectContaining({
        data,
        autoClose: 1200,
      })
    );
  });
});
