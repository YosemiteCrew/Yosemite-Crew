import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("react-icons/io", () => ({
  IoIosCloseCircleOutline: ({ onClick }: { onClick: () => void }) => (
    <button data-testid="close-videos-card" onClick={onClick}>
      close
    </button>
  ),
}));

jest.mock("react-icons/fa6", () => ({
  FaCirclePlay: () => <span data-testid="play-icon" />,
}));

import VideosCard from "@/app/components/Cards/VideosCard/VideosCard";

describe("VideosCard", () => {
  test("lists demo videos", () => {
    render(<VideosCard />);

    expect(
      screen.getByText(
        "Make the most of your wait — Start exploring instead."
      )
    ).toBeInTheDocument();
    expect(screen.getAllByTestId("play-icon")).toHaveLength(3);
    expect(screen.getByText("Inviting your team")).toBeInTheDocument();
  });

  test("closes the card when close icon is clicked", () => {
    render(<VideosCard />);

    fireEvent.click(screen.getByTestId("close-videos-card"));
    expect(
      screen.queryByText(
        "Make the most of your wait — Start exploring instead."
      )
    ).not.toBeInTheDocument();
  });
});
