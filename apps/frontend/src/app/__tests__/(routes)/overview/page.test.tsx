import Page from '@/app/(routes)/(public)/overview/page';
import { redirect } from 'next/navigation';

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

describe('Overview route', () => {
  it('redirects to insights', () => {
    Page();
    expect(redirect).toHaveBeenCalledWith('/insights');
  });
});
