import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import TeamSlide from "@/app/components/TeamSlide/TeamSlide";

jest.mock("next/image", () => {
    const MockImage = (props: any) => {
        return <img {...props} alt={props.alt} />;
    };
    MockImage.displayName = "MockNextImage";
    return {
        __esModule: true,
        default: MockImage,
    };
});


jest.mock("react-slick", () => {
    const MockSlider = ({ children }: { children: React.ReactNode }) => (
        <div data-testid="mock-slider">{children}</div>
    );
    MockSlider.displayName = 'MockSlider';
    return MockSlider;
});

describe("TeamSlide Component", () => {
    it("should render all team member images with correct alt text", () => {
        render(<TeamSlide />);

        const teamMembers = ["Surbhi", "Ankit", "Panvi", "Anna", "Suryansh"];

        teamMembers.forEach((name) => {
            const image = screen.getByAltText(name);
            expect(image).toBeInTheDocument();
        });
    });

    it("should have the correct image sources", () => {
        render(<TeamSlide />);

        const surbhiImage = screen.getByAltText("Surbhi") as HTMLImageElement;
        expect(surbhiImage.src).toBe(
            "https://d2il6osz49gpup.cloudfront.net/Images/team1.png"
        );

        const ankitImage = screen.getByAltText("Ankit") as HTMLImageElement;
        expect(ankitImage.src).toBe(
            "https://d2il6osz49gpup.cloudfront.net/Images/team2.png"
        );
    });
});