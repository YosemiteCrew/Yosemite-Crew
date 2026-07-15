import { render, screen } from '@testing-library/react';
import PassportPage, { metadata } from '@/app/(routes)/(share)/passport/[id]/page';

jest.mock('next/font/google', () => ({
  Newsreader: () => ({ variable: 'newsreader-var', className: 'nr' }),
}));
jest.mock('@/app/(routes)/(share)/passport/[id]/PassportClient', () => ({
  __esModule: true,
  default: ({ id }: { id: string }) => <div data-testid="passport-client">{id}</div>,
}));

describe('PassportPage (public pet passport route)', () => {
  it('renders PassportClient with the resolved id', async () => {
    const ui = await PassportPage({ params: Promise.resolve({ id: 'pp-7f2e' }) });
    render(ui);
    expect(screen.getByTestId('passport-client')).toHaveTextContent('pp-7f2e');
  });

  it('marks the public record as non-indexable', () => {
    expect(metadata.title).toBe('Pet Passport');
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
