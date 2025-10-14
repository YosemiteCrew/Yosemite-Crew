import { render, screen, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import PricingPage from '../../pages/PricingPage/PricingPage'
import { getPlanConfig } from '../../pages/PricingPage/PricingConst'

window.HTMLElement.prototype.scrollIntoView = jest.fn()

// Mock components to isolate the test
jest.mock('@/app/components/Footer/Footer', () =>
  function MockFooter() {
    return <footer>Footer Mock</footer>
  }
)

jest.mock('@/app/components/Faq/Faq', () =>
  function MockFaq() {
    return <div>FAQ Mock</div>
  }
)

jest.mock('@/app/pages/HomePage/HomePage', () => ({
  FillBtn: ({
    text,
    onClick,
    href,
  }: {
    text: string
    onClick?: () => void
    href?: string
  }) => (
    <a href={href || '#'} onClick={onClick}>
      {text}
    </a>
  ),
}))

jest.mock('@iconify/react/dist/iconify.js', () => ({
  Icon: (props: any) => <span {...props} />,
}))

describe('PricingPage Component', () => {
  const user = userEvent.setup()

  beforeEach(() => render(<PricingPage />))

  test('renders major headings and pricing cards correctly', () => {
    expect(screen.getByRole('heading', { name: /transparent pricing/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /hosting plan comparison/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /key features/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /pricing calculator/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /self-hosting \(free plan\)/i, level: 4 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Pay-as-you-go', level: 4 })).toBeInTheDocument()
  })

  test('calculator defaults to Free plan and shows correct price', () => {
    const freePlanToggle = screen.getByRole('radio', { name: /self-hosting/i }) as HTMLInputElement
    expect(freePlanToggle).toBeChecked()

    const estimatedBilling = screen.getByText('Estimated Billing').parentElement as HTMLElement
    const priceHeading = within(estimatedBilling).getByRole('heading', { level: 2 })
    expect(priceHeading).toHaveTextContent('$0')
  })

  test('switches to Custom plan and updates price', async () => {
    const customPlanToggle = screen.getByRole('radio', { name: /pay-as-you-go/i }) as HTMLInputElement
    await user.click(customPlanToggle)
    expect(customPlanToggle).toBeChecked()

    const planConfig = {
      appointments: 120,
      assessments: 200,
      seats: 2,
      setAppointments: jest.fn(),
      setAssessments: jest.fn(),
      setSeats: jest.fn(),
    }

    const expectedPrice = getPlanConfig(planConfig).custom.calculatePrice()

    const estimatedBilling = screen.getByText('Estimated Billing').parentElement as HTMLElement
    const priceHeading = within(estimatedBilling).getByRole('heading', { level: 2 })
    expect(priceHeading).toHaveTextContent(`$${expectedPrice}`)
  })

  test('calculator slider updates the price', async () => {
    const customPlanToggle = screen.getByRole('radio', { name: /pay-as-you-go/i }) as HTMLInputElement
    await user.click(customPlanToggle)

    const sliders = screen.getAllByRole('slider') as HTMLInputElement[]
    fireEvent.change(sliders[0], { target: { value: 500 } })

    const planConfig = {
      appointments: 500,
      assessments: 200,
      seats: 2,
      setAppointments: jest.fn(),
      setAssessments: jest.fn(),
      setSeats: jest.fn(),
    }

    const newPrice = getPlanConfig(planConfig).custom.calculatePrice()

    const estimatedBilling = screen.getByText('Estimated Billing').parentElement as HTMLElement
    const priceHeading = within(estimatedBilling).getByRole('heading', { level: 2 })
    expect(priceHeading).toHaveTextContent(`$${newPrice}`)
  })

  test('"Get Started" link updates with plan selection', async () => {
    const calculatorHeading = screen.getByRole('heading', { name: /pricing calculator/i }) as HTMLElement
    const calculatorSection = calculatorHeading.closest('.PricingCalculatorDiv') as HTMLElement
    const getStartedLink = within(calculatorSection).getByRole('link', { name: /get started/i }) as HTMLAnchorElement

    expect(getStartedLink).toHaveAttribute('href', '/developerslanding')

    const customPlanToggle = screen.getByRole('radio', { name: /pay-as-you-go/i }) as HTMLInputElement
    await user.click(customPlanToggle)

    expect(getStartedLink).toHaveAttribute('href', '/signup')
  })

  test('clicking plan card updates the calculator', async () => {
    const payAsYouGoCardHeading = screen.getByRole('heading', { name: 'Pay-as-you-go', level: 4 }) as HTMLElement
    const payAsYouGoCard = payAsYouGoCardHeading.closest('.PricingcardItem') as HTMLElement
    const getStartedButton = within(payAsYouGoCard).getByRole('link', { name: /get started/i }) as HTMLAnchorElement

    await user.click(getStartedButton)

    const customPlanToggle = screen.getByRole('radio', { name: /pay-as-you-go/i }) as HTMLInputElement
    expect(customPlanToggle).toBeChecked()
  })
})

describe('NeedHelp Component', () => {
  test('renders correctly and has a valid link', () => {
    render(<PricingPage />)
    expect(screen.getByRole('heading', { name: /need help\? we’re all ears!/i })).toBeInTheDocument()

    const getInTouchLink = screen.getByRole('link', { name: /get in touch/i }) as HTMLAnchorElement
    expect(getInTouchLink).toHaveAttribute('href', '/contact')
  })
<<<<<<< Updated upstream
})
=======
})
>>>>>>> Stashed changes
