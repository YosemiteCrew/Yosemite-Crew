import { render } from '@testing-library/react';

const mockGet = jest.fn();
jest.mock('next/headers', () => ({
  headers: jest.fn(() => Promise.resolve({ get: mockGet })),
}));

import ThemeScript from '@/app/ui/theme/ThemeScript';

describe('ThemeScript', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('tags the pre-paint script with the request nonce from x-nonce', async () => {
    mockGet.mockReturnValue('nonce-abc123');
    const { container } = render(await ThemeScript());
    const script = container.querySelector('script');
    expect(mockGet).toHaveBeenCalledWith('x-nonce');
    expect(script).not.toBeNull();
    expect(script?.getAttribute('nonce')).toBe('nonce-abc123');
    expect(script?.innerHTML).toContain("localStorage.getItem('yc-theme')");
    expect(script?.innerHTML).toContain("setAttribute('data-theme'");
  });

  it('renders the script without a nonce when the header is absent', async () => {
    mockGet.mockReturnValue(null);
    const { container } = render(await ThemeScript());
    const script = container.querySelector('script');
    expect(script).not.toBeNull();
    expect(script?.getAttribute('nonce')).toBeNull();
  });
});
