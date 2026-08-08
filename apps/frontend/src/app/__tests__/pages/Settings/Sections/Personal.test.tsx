import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Personal from '@/app/features/settings/pages/Settings/Sections/Personal';
import { summarizeAvailability } from '@/app/features/settings/pages/Settings/Sections/personal.utils';
import type { AvailabilityState } from '@/app/features/appointments/components/Availability/utils';

const useAuthStoreMock = jest.fn();
const usePrimaryOrgWithMembershipMock = jest.fn();
const usePrimaryOrgProfileMock = jest.fn();
const usePrimaryAvailabilityMock = jest.fn();

jest.mock('next/image', () => {
  const MockImage = ({ src, alt }: any) => <img src={src} alt={alt} />;
  MockImage.displayName = 'MockNextImage';
  return { __esModule: true, default: MockImage };
});

jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: (selector: any) => selector(useAuthStoreMock()),
}));

jest.mock('@/app/hooks/useOrgSelectors', () => ({
  usePrimaryOrgWithMembership: () => usePrimaryOrgWithMembershipMock(),
}));

jest.mock('@/app/hooks/useProfiles', () => ({
  usePrimaryOrgProfile: () => usePrimaryOrgProfileMock(),
}));

jest.mock('@/app/hooks/useAvailabiities', () => ({
  usePrimaryAvailability: () => usePrimaryAvailabilityMock(),
}));

const buildAvailability = (
  overrides: Partial<
    Record<string, { enabled: boolean; intervals: { start: string; end: string }[] }>
  >
): AvailabilityState => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days.reduce((acc, day) => {
    acc[day] = overrides[day] ?? { enabled: false, intervals: [{ start: '09:00', end: '17:00' }] };
    return acc;
  }, {} as AvailabilityState);
};

describe('summarizeAvailability', () => {
  it('returns null for null state', () => {
    expect(summarizeAvailability(null)).toBeNull();
  });

  it('returns null when no day is enabled', () => {
    expect(summarizeAvailability(buildAvailability({}))).toBeNull();
  });

  it('compresses consecutive weekdays into a single range with the widest interval', () => {
    const state = buildAvailability({
      Monday: { enabled: true, intervals: [{ start: '08:00', end: '16:00' }] },
      Tuesday: { enabled: true, intervals: [{ start: '09:00', end: '17:00' }] },
      Wednesday: { enabled: true, intervals: [{ start: '09:00', end: '17:00' }] },
      Thursday: { enabled: true, intervals: [{ start: '09:00', end: '17:00' }] },
      Friday: { enabled: true, intervals: [{ start: '09:00', end: '17:00' }] },
    });
    expect(summarizeAvailability(state)).toBe('Mon–Fri · 08:00–17:00');
  });

  it('lists non-consecutive days as separate groups', () => {
    const state = buildAvailability({
      Monday: { enabled: true, intervals: [{ start: '08:00', end: '12:00' }] },
      Wednesday: { enabled: true, intervals: [{ start: '08:00', end: '12:00' }] },
    });
    expect(summarizeAvailability(state)).toBe('Mon, Wed · 08:00–12:00');
  });

  it('ignores enabled days with no valid intervals', () => {
    const state = buildAvailability({
      Monday: { enabled: true, intervals: [] },
      Tuesday: { enabled: true, intervals: [{ start: '08:00', end: '17:00' }] },
    });
    expect(summarizeAvailability(state)).toBe('Tue · 08:00–17:00');
  });
});

describe('Settings Personal identity card', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStoreMock.mockReturnValue({
      attributes: { given_name: 'Sarah', family_name: 'Weber', email: 'sarah@vet.test' },
    });
    usePrimaryOrgWithMembershipMock.mockReturnValue({ membership: { roleDisplay: 'Owner' } });
    usePrimaryOrgProfileMock.mockReturnValue({
      professionalDetails: { specialization: 'small animals' },
      personalDetails: {},
    });
    usePrimaryAvailabilityMock.mockReturnValue({
      availabilities: buildAvailability({
        Monday: { enabled: true, intervals: [{ start: '08:00', end: '17:00' }] },
        Tuesday: { enabled: true, intervals: [{ start: '08:00', end: '17:00' }] },
        Wednesday: { enabled: true, intervals: [{ start: '08:00', end: '17:00' }] },
        Thursday: { enabled: true, intervals: [{ start: '08:00', end: '17:00' }] },
        Friday: { enabled: true, intervals: [{ start: '08:00', end: '17:00' }] },
      }),
    });
  });

  it('renders nothing without attributes', () => {
    useAuthStoreMock.mockReturnValue({ attributes: null });
    const { container } = render(<Personal />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the name, meta line, initials avatar and availability summary', () => {
    render(<Personal />);

    expect(screen.getByText('Sarah Weber')).toBeInTheDocument();
    expect(screen.getByText('sarah@vet.test · Owner · small animals')).toBeInTheDocument();
    expect(screen.getByText('SW')).toBeInTheDocument();
    expect(screen.getByText('Mon–Fri · 08:00–17:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit profile' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit hours' })).toBeInTheDocument();
  });

  it('renders the real avatar image when a https picture url is present', () => {
    usePrimaryOrgProfileMock.mockReturnValue({
      professionalDetails: {},
      personalDetails: { profilePictureUrl: 'https://cdn.test/a.png' },
    });
    render(<Personal />);
    const img = screen.getByRole('img', { name: 'Sarah Weber' });
    expect(img).toHaveAttribute('src', 'https://cdn.test/a.png');
  });

  it('shows "Not set" when no availability is configured', () => {
    usePrimaryAvailabilityMock.mockReturnValue({ availabilities: null });
    render(<Personal />);
    expect(screen.getByText('Not set')).toBeInTheDocument();
  });

  it('opens the profile and availability editors via the affordance callbacks', () => {
    const onEditProfile = jest.fn();
    const onEditHours = jest.fn();

    render(<Personal onEditProfile={onEditProfile} onEditHours={onEditHours} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit profile' }));
    expect(onEditProfile).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Edit hours' }));
    expect(onEditHours).toHaveBeenCalledTimes(1);
  });

  it('falls back to a placeholder name and omits the meta line when data is sparse', () => {
    useAuthStoreMock.mockReturnValue({ attributes: {} });
    usePrimaryOrgWithMembershipMock.mockReturnValue({ membership: null });
    usePrimaryOrgProfileMock.mockReturnValue(null);
    usePrimaryAvailabilityMock.mockReturnValue({ availabilities: null });

    render(<Personal />);
    expect(screen.getByText('Your profile')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
