import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import Github from "@/app/components/Github/Github";

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => {
    return <img {...props} alt={props.alt} />;
  },
}));

jest.mock("@iconify/react/dist/iconify.js", () => ({
  Icon: (props: any) => <i data-testid="mock-icon" data-icon={props.icon} />,
}));

jest.mock("react-icons/io5", () => ({
  IoCloseSharp: () => <svg data-testid="close-icon" />,
}));

const mockFetch = jest.fn();
globalThis.fetch = mockFetch;

describe("Github Component", () => {
  beforeEach(() => {
    mockFetch.mockClear();
    localStorage.clear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should render the banner and show a loading state initially", async () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<Github />);

    expect(screen.getByText("Star us on Github")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Star/i })).toBeInTheDocument();
    expect(screen.getByText("…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("should fetch and display the formatted star count successfully", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ stargazers_count: 12345 }),
    });

    render(<Github />);

    await waitFor(() => {
      expect(screen.getByText(/12.3k/i)).toBeInTheDocument();
    });

    expect(localStorage.getItem("gh:stars:YosemiteCrew/Yosemite-Crew")).toContain("12345");
  });

  it("should display cached count then update from fetch", async () => {
    const cachedValue = { value: 987, ts: Date.now() };
    localStorage.setItem("gh:stars:YosemiteCrew/Yosemite-Crew", JSON.stringify(cachedValue));
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ stargazers_count: 1234 }),
    });

    render(<Github />);

    expect(screen.getByText("987")).toBeInTheDocument();

    await waitFor(() => {
        expect(screen.getByText(/1.2k/i)).toBeInTheDocument();
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("should ignore expired cache and fetch new data", async () => {
    const expiredCache = { value: 500, ts: Date.now() - 2 * 60 * 60 * 1000 };
    localStorage.setItem("gh:stars:YosemiteCrew/Yosemite-Crew", JSON.stringify(expiredCache));

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ stargazers_count: 1500 }),
    });

    render(<Github />);

    expect(screen.getByText("…")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/1.5k/i)).toBeInTheDocument();
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("should handle corrupted cache by fetching new data", async () => {
    localStorage.setItem("gh:stars:YosemiteCrew/Yosemite-Crew", "invalid-json");

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ stargazers_count: 2000 }),
    });

    render(<Github />);

    await waitFor(() => {
      expect(screen.getByText(/2k/i)).toBeInTheDocument();
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("should handle API returning a non-finite star count", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ stargazers_count: "not-a-number" }),
    });

    render(<Github />);
    await waitFor(() => {
      expect(screen.getByText("—")).toBeInTheDocument();
    });
  });

  it("should not crash if localStorage is unavailable or full", async () => {
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error("Quota exceeded");
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ stargazers_count: 3000 }),
    });

    render(<Github />);

    await waitFor(() => {
      expect(screen.getByText(/3k/i)).toBeInTheDocument();
    });

    expect(setItemSpy).toHaveBeenCalled();
    setItemSpy.mockRestore();
  });

  it("should display an error state if the fetch fails", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    render(<Github />);

    await waitFor(() => {
      expect(screen.getByText("—")).toBeInTheDocument();
    });
  });

  it("should display an error state if the API response is not ok", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
    });

    render(<Github />);

    await waitFor(() => {
      expect(screen.getByText("—")).toBeInTheDocument();
    });
  });

  it("should close the banner when the close button is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ stargazers_count: 100 }),
    });
    render(<Github />);

    await waitFor(() => expect(screen.getByText("100")).toBeInTheDocument());

    const banner = screen.getByText("Star us on Github");
    expect(banner).toBeInTheDocument();

    const closeButton = screen.getByRole("button", { name: "Close" });
    await user.click(closeButton);

    expect(banner).not.toBeInTheDocument();
  });

  it("should clear interval on unmount", () => {
    const clearIntervalSpy = jest.spyOn(globalThis, 'clearInterval');
    mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ stargazers_count: 100 }),
      });
    const { unmount } = render(<Github />);

    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});

