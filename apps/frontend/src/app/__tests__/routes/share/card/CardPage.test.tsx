import { render, screen } from '@testing-library/react';
import CardPage, { metadata } from '@/app/(routes)/(share)/card/[token]/page';

jest.mock('@/app/(routes)/(share)/card/[token]/CardClient', () => ({
  __esModule: true,
  default: ({ token }: { token: string }) => <div data-testid="card-client">{token}</div>,
}));

describe('CardPage (public companion card route)', () => {
  it('renders CardClient with the resolved token', async () => {
    const ui = await CardPage({ params: Promise.resolve({ token: 'tok-8f3k2m1x' }) });
    render(ui);
    expect(screen.getByTestId('card-client')).toHaveTextContent('tok-8f3k2m1x');
  });

  it('marks the shared card as non-indexable', () => {
    expect(metadata.title).toBe('Companion Card');
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
