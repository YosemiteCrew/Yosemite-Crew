import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import FileInput from "@/app/components/Inputs/FileInput/FileInput";

describe("FileInput", () => {
  test("renders hidden file input with accessible label", () => {
    render(<FileInput />);

    const input = screen.getByLabelText("Upload documents (optional)");
    expect(input).toHaveAttribute("type", "file");
    expect(input).toHaveAttribute("id", "file-professioal-upload");

    expect(screen.getByText("Only DOC, PDF, PNG, and JPEG formats, with maximum size of 5 MB.")).toBeInTheDocument();
  });
});
