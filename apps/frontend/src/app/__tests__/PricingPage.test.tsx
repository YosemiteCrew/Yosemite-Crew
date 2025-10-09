import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import PricingPage from '../pages/PricingPage/PricingPage';
import { getPlanConfig } from '../pages/PricingPage/PricingConst';

window.HTMLElement.prototype.scrollIntoView = jest.fn();

jest.mock('@/app/components/Footer/Footer', () => () => <footer>Footer Mock</footer>);
jest.mock('@/app/components/Faq/Faq', () => () => <div>FAQ Mock</div>);
jest.mock('@/app/pages/HomePage/HomePage', () => ({
  FillBtn: ({ text, onClick, href }) => <a href={href || '#'} onClick={onClick}>{text}</a>,
}));
jest.mock('@iconify/react/dist/iconify.js', () => ({ Icon: (props) => <span {...props} /> }));

describe('PricingPage Component', () => {
  const user = userEvent.setup();

  beforeEach(() => render(<PricingPage />));

  test('renders major headings and pricing cards correctly', () => {
    expect(screen.getByRole('heading', { name: /transparent pricing/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /hosting plan comparison/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /key features/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /pricing calculator/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /self-hosting \(free plan\)/i, level: 4 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pay-as-you-go', level: 4 })).toBeInTheDocument();
  });

  test('calculator defaults to Free plan and shows correct price', () => {
    const freePlanToggle = screen.getByRole('radio', { name: /self-hosting/i });
    expect(freePlanToggle).toBeChecked();

    const estimatedBilling = screen.getByText('Estimated Billing').parentElement!;
    const priceHeading = within(estimatedBilling).getByRole('heading', { level: 2 });
    expect(priceHeading).toHaveTextContent('$0');
  });

  test('switches to Custom plan and updates price', async () => {
    const customPlanToggle = screen.getByRole('radio', { name: /pay-as-you-go/i });
    await user.click(customPlanToggle);
    expect(customPlanToggle).toBeChecked();

    const expectedPrice = getPlanConfig({ appointments: 120, assessments: 200, seats: 2 }).custom.calculatePrice();
    const estimatedBilling = screen.getByText('Estimated Billing').parentElement!;
    const priceHeading = within(estimatedBilling).getByRole('heading', { level: 2 });
    expect(priceHeading).toHaveTextContent(`$${expectedPrice}`);
  });

  test('calculator slider updates the price', async () => {
    const customPlanToggle = screen.getByRole('radio', { name: /pay-as-you-go/i });
    await user.click(customPlanToggle);

    const sliders = screen.getAllByRole('slider');
    fireEvent.change(sliders[0], { target: { value: 500 } });

    const newPrice = getPlanConfig({ appointments: 500, assessments: 200, seats: 2 }).custom.calculatePrice();
    const estimatedBilling = screen.getByText('Estimated Billing').parentElement!;
    const priceHeading = within(estimatedBilling).getByRole('heading', { level: 2 });
    expect(priceHeading).toHaveTextContent(`$${newPrice}`);
  });

  test('"Get Started" link updates with plan selection', async () => {
    const calculatorHeading = screen.getByRole('heading', { name: /pricing calculator/i });
    const calculatorSection = calculatorHeading.closest('.PricingCalculatorDiv')!;
    const getStartedLink = within(calculatorSection).getByRole('link', { name: /get started/i });
    expect(getStartedLink).toHaveAttribute('href', '/developerslanding');

    const customPlanToggle = screen.getByRole('radio', { name: /pay-as-you-go/i });
    await user.click(customPlanToggle);
    expect(getStartedLink).toHaveAttribute('href', '/signup');
  });

  test('clicking plan card updates the calculator', async () => {
    const payAsYouGoCard = screen.getByRole('heading', { name: 'Pay-as-you-go', level: 4 })
      .closest('.PricingcardItem')!;
    const getStartedButton = within(payAsYouGoCard).getByRole('link', { name: /get started/i });

    await user.click(getStartedButton);
    const customPlanToggle = screen.getByRole('radio', { name: /pay-as-you-go/i });
    expect(customPlanToggle).toBeChecked();
  });
});

describe('NeedHelp Component', () => {
  test('renders correctly and has a valid link', () => {
    render(<PricingPage />);
    expect(screen.getByRole('heading', { name: /need help\? we’re all ears!/i })).toBeInTheDocument();
    const getInTouchLink = screen.getByRole('link', { name: /get in touch/i });
    expect(getInTouchLink).toHaveAttribute('href', '/contact');
  });
});
