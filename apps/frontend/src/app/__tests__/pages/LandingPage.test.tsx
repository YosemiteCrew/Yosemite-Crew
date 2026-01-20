import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import MainLandingPage from "../../pages/LandingPage/LandingPage";
import { useAuthStore } from "@/app/stores/authStore";

jest.mock("@/app/components/Footer/Footer", () => {
  return function DummyFooter() {
    return <footer>Footer Mock</footer>;
  };
});

beforeEach(() => {
  useAuthStore.setState({ user: null, role: null });
});

describe("MainLandingPage Component", () => {
  test("renders the new hero heading, description, and primary CTA", () => {
    render(<MainLandingPage />);

    const mainHeading = screen.getByText(
      /open source operating system for animal health/i
    );
    expect(mainHeading).toBeInTheDocument();

    const heroSection = mainHeading.closest("section");

    if (heroSection === null) {
      fail("Expected hero section to be in the document");
    }

    expect(heroSection).toBeInTheDocument();

    const heroDescription = within(heroSection).getByText(
      /designed for pet businesses, pet parents, and developers/i
    );
    expect(heroDescription).toBeInTheDocument();

    const primaryCta = within(heroSection).getByRole("link", {
      name: /get started free/i,
    });

    expect(primaryCta).toBeInTheDocument();

    expect(primaryCta).toHaveAttribute("href", "/signup");
  });

  test("displays hero imagery assets", () => {
    render(<MainLandingPage />);

    expect(screen.getByAltText("Dog")).toBeInTheDocument();
    expect(screen.getByAltText("Horse")).toBeInTheDocument();
  });

  test("renders all section headings and links", () => {
    render(<MainLandingPage />);

    expect(
      screen.getByText(/streamlined solutions for busy pet businesses/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/designed for pet parents. simple, intuitive, reliable/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/pay as you grow, no strings attached/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/built for innovators/i)
    ).toBeInTheDocument();

    const learnMoreLinks = screen.getAllByRole("link", { name: /learn more/i });
    expect(learnMoreLinks).toHaveLength(4);

    expect(learnMoreLinks[2]).toHaveAttribute("href", "/pricing");
    expect(learnMoreLinks[3]).toHaveAttribute("href", "/developers");
  });
});
