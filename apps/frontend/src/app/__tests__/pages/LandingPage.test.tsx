import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import MainLandingPage from '../../pages/LandingPage/LandingPage';

jest.mock('@/app/Components/Footer/Footer', () => {
  return function DummyFooter() {
    return <footer>Footer Mock</footer>;
  };
});

describe('MainLandingPage Component', () => {

  test('renders the main heading and call-to-action buttons', () => {
    render(<MainLandingPage />);

    const mainHeading = screen.getByRole('heading', {
      name: /open source operating system for animal health/i,
    });
    expect(mainHeading).toBeInTheDocument();

    const heroSection = mainHeading.closest('section');

    const bookDemoButton = within(heroSection).getByRole('link', { name: /book a demo/i });
    const learnMoreButton = within(heroSection).getByRole('link', { name: /learn more/i });

    expect(bookDemoButton).toBeInTheDocument();
    expect(learnMoreButton).toBeInTheDocument();

    expect(bookDemoButton).toHaveAttribute('href', '/book-demo');
    expect(learnMoreButton).toHaveAttribute('href', '/pms');
  });

  test('renders the initial carousel slide content', () => {
    render(<MainLandingPage />);

    const firstSlideText = screen.getByText(/empowering veterinary businesses to grow efficiently/i);
    expect(firstSlideText).toBeInTheDocument();
  });

  test('carousel navigates to the next slide on user click', async () => {
    const user = userEvent.setup();
    render(<MainLandingPage />);

    const nextButton = screen.getAllByRole('button', { hidden: true })[1];

    await user.click(nextButton);

    const secondSlideText = await screen.findByText(/simplifying pet health management for owners/i);
    expect(secondSlideText).toBeInTheDocument();
  });

  test('renders all section headings and links', () => {
    render(<MainLandingPage />);

    expect(screen.getByRole('heading', { name: /streamlined solutions for busy vets/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /designed for pet owners — simple, intuitive, reliable/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /pay as you grow, no strings attached/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /built for innovators/i })).toBeInTheDocument();

    const learnMoreLinks = screen.getAllByRole('link', { name: /learn more/i });
    expect(learnMoreLinks).toHaveLength(5);

    expect(learnMoreLinks[2]).toHaveAttribute('href', '/application');
    expect(learnMoreLinks[3]).toHaveAttribute('href', '/pricing');
    expect(learnMoreLinks[4]).toHaveAttribute('href', '/developers');
  });
});