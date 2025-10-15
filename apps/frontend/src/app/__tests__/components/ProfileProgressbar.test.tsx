import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import ProfileProgressbar from "@/app/components/ProfileProgressbar/ProfileProgressbar";

jest.mock("next/image", () => {
    const MockImage = ({ alt }: { alt: string }) => {
        return <img alt={alt} />;
    };
    MockImage.displayName = "MockNextImage";
    return {
        __esModule: true,
        default: MockImage,
    };
});

jest.mock("react-bootstrap/Button", () => {
    const MockButton = ({ children, onClick, className }: { children: React.ReactNode; onClick: () => void; className: string }) => (
        <button className={className} onClick={onClick}>
            {children}
        </button>
    );
    MockButton.displayName = "MockBootstrapButton";
    return MockButton;
});

describe("ProfileProgressbar Component", () => {
    it("should render the names and default progress of 0% when progress is not provided", () => {
        render(<ProfileProgressbar blname="John" spname="Doe" />);

        expect(screen.getByRole("heading", { name: "John Doe" })).toBeInTheDocument();

        const progressText = screen.getByText((content, element) => {
            return element?.tagName.toLowerCase() === 'p' && /0%\s*Complete/i.test(element.textContent || '');
        });
        expect(progressText).toBeInTheDocument();

        const progressFill = progressText.previousElementSibling?.firstChild as HTMLElement;
        expect(progressFill).toHaveStyle("width: 0%");
    });

    it("should render the correct progress percentage when provided", () => {
        render(<ProfileProgressbar blname="Jane" spname="Doe" progres={60} />);

        expect(screen.getByRole("heading", { name: "Jane Doe" })).toBeInTheDocument();

        const progressText = screen.getByText((content, element) => {
            return element?.tagName.toLowerCase() === 'p' && /60%\s*Complete/i.test(element.textContent || '');
        });
        expect(progressText).toBeInTheDocument();

        const progressFill = progressText.previousElementSibling?.firstChild as HTMLElement;
        expect(progressFill).toHaveStyle("width: 60%");
    });

    it("should call the onclicked handler when the 'Complete Later' button is clicked", async () => {
        const user = userEvent.setup();
        const mockOnClick = jest.fn();
        render(<ProfileProgressbar blname="Test" spname="User" onclicked={mockOnClick} />);

        const completeButton = screen.getByRole("button", { name: /Complete Later/i });

        await user.click(completeButton);

        expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it("should render the 'Complete Later' button with its icon", () => {
        render(<ProfileProgressbar blname="Test" spname="User" />);

        const button = screen.getByRole("button", { name: /Complete Later/i });
        expect(button).toBeInTheDocument();

        const image = screen.getByAltText("Complete Later");
        expect(button).toContainElement(image);
    });
});