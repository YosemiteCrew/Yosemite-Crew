import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import RelatesArticle from "@/app/components/RelatesArticle/RelatesArticle";

jest.mock("next/image", () => {
    const MockImage = ({ alt, ...props }: { alt: string }) => {
        // eslint-disable-next-line @next/next/no-img-element
        return <img alt={alt} {...props} />;
    };
    // FIX: Added display name
    MockImage.displayName = 'MockNextImage';
    return {
        __esModule: true,
        default: MockImage,
    };
});

jest.mock("react-slick", () => {
    const MockSlider = ({ children }: { children: React.ReactNode }) => (
        <div data-testid="mock-slider">{children}</div>
    );
    // FIX: Added display name
    MockSlider.displayName = 'MockSlider';
    return MockSlider;
});

describe("RelatesArticle Component", () => {
    beforeEach(() => {
        process.env.VITE_BASE_IMAGE_URL = "https://d2il6osz49gpup.cloudfront.net";
        render(<RelatesArticle />);
    });

    it("should render all article cards with their correct content", () => {
        expect(screen.getByRole("heading", { name: "How To Stop a Puppy From Biting" })).toBeInTheDocument();
        expect(screen.getByAltText("Rls1")).toBeInTheDocument();
        expect(screen.getByText("8 mins read")).toBeInTheDocument();

        expect(screen.getByRole("heading", { name: /Should You Get Puppy Insurance/i })).toBeInTheDocument();
        expect(screen.getByAltText("Rls2")).toBeInTheDocument();
        expect(screen.getByText("4 mins read")).toBeInTheDocument();

        expect(screen.getByRole("heading", { name: /6 Dog Sleeping Positions and What They Mean/i })).toBeInTheDocument();
        expect(screen.getByAltText("Rls3")).toBeInTheDocument();
        expect(screen.getByText("5 mins read")).toBeInTheDocument();

        expect(screen.getByRole("heading", { name: "How Much To Feed a Puppy" })).toBeInTheDocument();
        expect(screen.getByAltText("Rls4")).toBeInTheDocument();
        expect(screen.getByText("3 mins read")).toBeInTheDocument();
    });

    it("should render all article categories correctly", () => {
        const trainingCategories = screen.getAllByRole("heading", { name: "Training" });
        expect(trainingCategories).toHaveLength(2);

        expect(screen.getByRole("heading", { name: "Wellness" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Nutrition" })).toBeInTheDocument();
    });
});