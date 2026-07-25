import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

const back = jest.fn();
let params: Map<string, string>;
jest.mock('next/navigation', () => ({
  useRouter: () => ({ back }),
  useSearchParams: () => ({ get: (key: string) => params.get(key) ?? null }),
}));

import BackToSignup from '@/app/features/legal/components/BackToSignup';

describe('BackToSignup', () => {
  beforeEach(() => {
    back.mockReset();
    params = new Map();
  });

  it('renders nothing when the visitor did not arrive from sign up', () => {
    const { container } = render(<BackToSignup />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a back control and returns to sign up on click when ref=signup', () => {
    params = new Map([['ref', 'signup']]);
    render(<BackToSignup />);
    const button = screen.getByRole('button', { name: /back to sign up/i });
    fireEvent.click(button);
    expect(back).toHaveBeenCalledTimes(1);
  });
});
