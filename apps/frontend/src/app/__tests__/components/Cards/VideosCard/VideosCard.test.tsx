import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import VideosCard from "@/app/components/Cards/VideosCard/VideosCard";

jest.mock("@/app/components/Icons/Close", () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      close
    </button>
  ),
}));

describe("VideosCard", () => {
  it("renders demo video titles", () => {
    render(<VideosCard />);

    expect(
      screen.getByText("Make the most of your wait — Start exploring instead.")
    ).toBeInTheDocument();
    expect(screen.getByText("Inviting your team")).toBeInTheDocument();
    expect(screen.getByText("How to add companions")).toBeInTheDocument();
    expect(
      screen.getByText("How to write consultation notes")
    ).toBeInTheDocument();
  });

  it("closes when the close icon is clicked", () => {
    render(<VideosCard />);

    fireEvent.click(screen.getByText("close"));
    expect(
      screen.queryByText("Make the most of your wait — Start exploring instead.")
    ).not.toBeInTheDocument();
  });
});
