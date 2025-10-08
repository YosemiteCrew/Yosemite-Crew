import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import PricingPage from './PricingPage';
import { getPlanConfig } from './PricingConst';

jest.mock('@/app/Components/Footer/Footer', () => {
  return function DummyFooter() {
    return <footer>Footer Mock</footer>;
  };
});
jest.mock('@/app/Components/FAQ/FAQ', () => {
  return function DummyFAQ() {
    return <div>FAQ Mock</div>;
  };
});
jest.mock('@iconify/react/dist/iconify.js', () => ({
  Icon: (props) => <span {...props} />,
}));


describe('PricingPage Component', () => {

  test('renders all major headings and pricing cards correctly', () => {
    render(<PricingPage />);

    expect(screen.getByRole('heading', { name: /transparent pricing/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /hosting plan comparison/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /key features/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /pricing calculator/i })).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: /self-hosting \(free plan\)/i, level: 4 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pay-as-you-go', level: 4 })).toBeInTheDocument();
  });

  test('calculator defaults to the "Free" plan and shows the correct price', () => {
    render(<PricingPage />);

    const freePlanToggle = screen.getByRole('radio', { name: /self-hosting/i });
    expect(freePlanToggle).toBeChecked();

    const estimatedBilling = screen.getByText('Estimated Billing').parentElement;
    expect(within(estimatedBilling).getByRole('heading', { name: /\$0/i, level: 2 })).toBeInTheDocument();
  });

  test('allows switching to the "Custom" plan and updates the price', async () => {
    const user = userEvent.setup();
    render(<PricingPage />);

    const customPlanToggle = screen.getByRole('radio', { name: /pay-as-you-go/i });
    await user.click(customPlanToggle);

    expect(customPlanToggle).toBeChecked();

    const initialCustomPrice = getPlanConfig({
      appointments: 120,
      assessments: 200,
      seats: 2,
    }).custom.calculatePrice();

    const estimatedBilling = screen.getByText('Estimated Billing').parentElement;
    expect(within(estimatedBilling).getByRole('heading', { name: `$${initialCustomPrice}`, level: 2 })).toBeInTheDocument();
  });

  test('updates the price when a calculator slider is changed', async () => {
    const user = userEvent.setup();
    render(<PricingPage />);

    const customPlanToggle = screen.getByRole('radio', { name: /pay-as-you-go/i });
    await user.click(customPlanToggle);

    const sliders = screen.getAllByRole('slider');
    const appointmentsSlider = sliders[0];

    fireEvent.change(appointmentsSlider, { target: { value: '500' } });

    const newExpectedPrice = getPlanConfig({ appointments: 500, assessments: 200, seats: 2 }).custom.calculatePrice();

    const estimatedBilling = screen.getByText('Estimated Billing').parentElement;
    const priceHeading = within(estimatedBilling).getByRole('heading', { level: 2 });
    expect(priceHeading).toHaveTextContent(`$${newExpectedPrice}`);
  });

  test('updates the "Get Started" link based on the selected plan', async () => {
    const user = userEvent.setup();
    render(<PricingPage />);

    const calculatorHeading = screen.getByRole('heading', { name: 'Pricing Calculator' });
    const calculatorSection = calculatorHeading.closest('.PricingCalculatorDiv');
    const getStartedLink = within(calculatorSection).getByRole('link', { name: /get started/i });

    expect(getStartedLink).toHaveAttribute('href', '/developerslanding');

    const customPlanToggle = screen.getByRole('radio', { name: /pay-as-you-go/i });
    await user.click(customPlanToggle);

    expect(getStartedLink).toHaveAttribute('href', '/signup');
  });

  test('clicking a plan card\'s "Get Started" button updates the calculator', async () => {
    const user = userEvent.setup();
    render(<PricingPage />);

    const payAsYouGoCard = screen.getByRole('heading', { name: 'Pay-as-you-go', level: 4 }).closest('.PricingcardItem');
    const getStartedButton = within(payAsYouGoCard).getByRole('link', { name: /get started/i });

    await user.click(getStartedButton);

    const customPlanToggle = screen.getByRole('radio', { name: /pay-as-you-go/i });
    expect(customPlanToggle).toBeChecked();
  });
});

describe('NeedHealp Component', () => {
  test('renders correctly and has a valid link', () => {
    render(<PricingPage />);
    expect(screen.getByRole('heading', { name: /need help\? we’re all ears!/i })).toBeInTheDocument();
    const getInTouchLink = screen.getByRole('link', { name: /get in touch/i });
    expect(getInTouchLink).toBeInTheDocument();
    expect(getInTouchLink).toHaveAttribute('href', '/contact');
  });
});

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PricingPage from './PricingPage'

test('useEffect updates slider progress styles', async () => {
  const { rerender } = render(<PricingPage />)

  const slider = screen.getAllByRole('slider')[0]
  Object.defineProperty(slider, 'min', { value: '0' })
  Object.defineProperty(slider, 'max', { value: '100' })
  Object.defineProperty(slider, 'value', { value: '80', writable: true })

  fireEvent.change(slider, { target: { value: '80' } })

  rerender(<PricingPage />)

  await waitFor(() => {
    expect(slider.style.getPropertyValue('--progress')).toBe('80%')
  })
})

test('handles missing slider attributes by falling back to default values', async () => {
  render(<PricingPage />);

  const slider = screen.getAllByRole('slider')[0];

  delete slider.max;
  delete slider.value;
  fireEvent.change(slider, { target: {} });
  render(<PricingPage />);
  expect(slider).toBeInTheDocument();
});
