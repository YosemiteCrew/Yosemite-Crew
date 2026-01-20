import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import HomePage, { FillBtn } from "../../pages/HomePage/HomePage";
import userEvent from "@testing-library/user-event";
import { useAuthStore } from "@/app/stores/authStore";

jest.mock("@/app/components/Header/Header", () => {
  return function DummyHeader() {
    return <header>Header Mock</header>;
  };
});

jest.mock("@/app/components/Footer/Footer", () => {
  return function DummyFooter() {
    return <footer>Footer Mock</footer>;
  };
});

beforeEach(() => {
  useAuthStore.setState({ user: null, role: null });
});

describe("HomePage Component", () => {
  test("renders the main hero headings", () => {
    render(<HomePage />);

    const heading1 = screen.getByText(/helping you help pets/i);
    const heading2 = screen.getByText(/without the hassle/i);

    expect(heading1).toBeInTheDocument();
    expect(heading2).toBeInTheDocument();
  });

  test("renders call-to-action buttons with correct links", () => {
    render(<HomePage />);

    const mainHeading = screen.getByText(/helping you help pets/i);

    const heroSection = mainHeading.closest("section");

    if (heroSection === null) {
      fail("Expected hero section to be in the document");
    }

    expect(heroSection).toBeInTheDocument();

    const primaryCta = within(heroSection).getByRole("link", {
      name: /get started free/i,
    });

    expect(primaryCta).toBeInTheDocument();

    expect(primaryCta).toHaveAttribute("href", "/signup");
  });

  test('renders the "Run Your Practice" section heading', () => {
    render(<HomePage />);

    const practiceHeading = screen.getByText(/everything you need to run your pet business/i);
    expect(practiceHeading).toBeInTheDocument();
  });

  test('renders a specific practice feature like "Medical Records Management"', () => {
    render(<HomePage />);

    const medicalRecordsText = screen.getByText(
      /organize animal data, treatment history, and prescriptions/i
    );
    expect(medicalRecordsText).toBeInTheDocument();
  });

  test('renders the "Focus on Care" section heading', () => {
    render(<HomePage />);

    const focusHeading = screen.getByText(/focus on care, not admin/i);
    expect(focusHeading).toBeInTheDocument();
  });

  test('renders the "Caring for the Vets" section heading', () => {
    render(<HomePage />);

    const caringHeading = screen.getByText(/caring for vets, who care for pets/i);
    expect(caringHeading).toBeInTheDocument();
  });
});

describe("FillBtn Component", () => {
  test("calls the onClick handler when clicked", async () => {
    const user = userEvent.setup();
    const mockOnClick = jest.fn();

    render(
      <FillBtn text="Click Me" href="#" icon={<svg />} onClick={mockOnClick} />
    );

    const buttonElement = screen.getByRole("link", { name: /click me/i });
    await user.click(buttonElement);

    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });
});
