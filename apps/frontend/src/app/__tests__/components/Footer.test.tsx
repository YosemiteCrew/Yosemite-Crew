import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import Footer from "@/app/components/Footer/Footer";

jest.mock("next/image", () => {
    const MockImage = (props: any) => {
        // eslint-disable-next-line @next/next/no-img-element
        return <img {...props} alt={props.alt} />;
    };
    MockImage.displayName = "MockNextImage";
    return {
        __esModule: true,
        default: MockImage,
    };
});

jest.mock("next/link", () => {
    const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => {
        return <a href={href}>{children}</a>;
    };
    // FIX: Added display name to the mock component
    MockLink.displayName = "MockNextLink";
    return MockLink;
});

jest.mock("framer-motion", () => {
    const motion = {
        footer: (props: any) => <footer {...props} />,
        div: (props: any) => <div {...props} />,
        nav: (props: any) => <nav {...props} />,
    };

    // FIX: Added display names to the motion components
    motion.footer.displayName = "MotionFooter";
    motion.div.displayName = "MotionDiv";
    motion.nav.displayName = "MotionNav";

    return {
        ...jest.requireActual("framer-motion"),
        useInView: () => true,
        motion: motion,
    };
});

describe("Footer Component", () => {
    beforeEach(() => {
        render(<Footer />);
    });

    it("should render the main logo and certification images", () => {
        expect(screen.getByAltText("Yosemite Crew Logo")).toBeInTheDocument();
        expect(screen.getByAltText("GDPR")).toBeInTheDocument();
        expect(screen.getByAltText("SOC2")).toBeInTheDocument();
        expect(screen.getByAltText("HL7 FHIR")).toBeInTheDocument();
        expect(screen.getByAltText("ISO 27001")).toBeInTheDocument();
    });

    it("should render all navigation section titles", () => {
        expect(screen.getByRole("heading", { name: "Developers" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Community" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Company" })).toBeInTheDocument();
    });

    it("should render all navigation links with correct href attributes", () => {
        const gettingStartedLink = screen.getByRole("link", { name: "Getting Started" });
        expect(gettingStartedLink).toBeInTheDocument();
        expect(gettingStartedLink).toHaveAttribute("href","https://github.com/YosemiteCrew/Yosemite-Crew/blob/main/README.md");

        const discordLink = screen.getByRole("link", { name: "Discord" });
        expect(discordLink).toBeInTheDocument();
        expect(discordLink).toHaveAttribute("href", "https://discord.gg/4zDVekEz");

        const aboutUsLink = screen.getByRole("link", { name: "About us" });
        expect(aboutUsLink).toBeInTheDocument();
        expect(aboutUsLink).toHaveAttribute("href", "/about");
    });

    it("should render the copyright and contact information", () => {
        expect(screen.getByText(/Copyright © 2025 DuneXploration/i)).toBeInTheDocument();

        const emailLink = screen.getByRole("link", { name: "support@yosemitecrew.com" });
        expect(emailLink).toBeInTheDocument();
        expect(emailLink).toHaveAttribute("href", "mailto:support@yosemitecrew.com");

        const phoneLink = screen.getByRole("link", { name: "+49 152 277 63275" });
        expect(phoneLink).toBeInTheDocument();
        expect(phoneLink).toHaveAttribute("href", "tel:+4915227763275");
    });
});