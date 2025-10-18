import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import HomePage from "@/app/pages/HomePage/HomePage";
import userEvent from '@testing-library/user-event';

jest.mock('@/app/components/Header/Header', () => {
  return function DummyHeader() {
    return <header>Header Mock</header>;
  };
});

jest.mock('@/app/components/Footer/Footer', () => {
  return function DummyFooter() {
    return <footer>Footer Mock</footer>;
  };
});

describe('HomePage Component', () => {

  test('renders the main hero headings', () => {
    render(<HomePage />);

    const heading1 = screen.getByRole('heading', { name: /helping you help pets/i });
    const heading2 = screen.getByRole('heading', { name: /without the hassle/i });

    expect(heading1).toBeInTheDocument();
    expect(heading2).toBeInTheDocument();
  });

  test('renders call-to-action buttons with correct links', () => {
    render(<HomePage />);

    const mainHeading = screen.getByRole('heading', {
      name: /helping you help pets/i,
    });

    const heroSection = mainHeading.closest('section');

    expect(heroSection).toBeInTheDocument();

    const getStartedLink = within(heroSection!).getByRole('link', { name: /get started/i });
    const bookDemoLink = within(heroSection!).getByRole('link', { name: /book a demo/i });

    expect(getStartedLink).toBeInTheDocument();
    expect(bookDemoLink).toBeInTheDocument();

    expect(getStartedLink).toHaveAttribute('href', '/signup');
    expect(bookDemoLink).toHaveAttribute('href', '/book-demo');
  });

  test('renders the "Run Your Practice" section heading', () => {
    render(<HomePage />);

    const practiceHeading = screen.getByRole('heading', { name: /everything you need to run your practice/i });
    expect(practiceHeading).toBeInTheDocument();
  });

  test('renders a specific practice feature like "Medical Records Management"', () => {
    render(<HomePage />);

    const medicalRecordsText = screen.getByText(/organize animal data, treatment history, and prescriptions/i);
    expect(medicalRecordsText).toBeInTheDocument();
  });

  test('renders the "Focus on Care" section heading', () => {
    render(<HomePage />);

    const focusHeading = screen.getByRole('heading', { name: /focus on care, not admin/i });
    expect(focusHeading).toBeInTheDocument();
  });

  test('renders the "Caring for the Vets" section heading', () => {
    render(<HomePage />);

    const caringHeading = screen.getByRole('heading', { name: /caring for the vets who care for pets/i });
    expect(caringHeading).toBeInTheDocument();
  });

});
import { FillBtn } from '../../pages/HomePage/HomePage';

describe('FillBtn Component', () => {
  test('calls the onClick handler when clicked', async () => {
    const user = userEvent.setup();
    const mockOnClick = jest.fn();

    render(<FillBtn text="Click Me" href="#" icon={<svg />} onClick={mockOnClick} />);

    const buttonElement = screen.getByRole('link', { name: /click me/i });
    await user.click(buttonElement);

    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });
});