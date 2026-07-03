import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('next/navigation', () => ({
  redirect: jest.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => ({ get: () => null }),
}));

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: (loader: () => Promise<{ default: React.ComponentType }>) => {
    let Component: React.ComponentType | null = null;
    loader().then((mod) => {
      Component = mod.default;
    });
    const MockDynamic = (props: Record<string, unknown>) =>
      Component ? React.createElement(Component, props) : null;
    MockDynamic.displayName = 'MockDynamic';
    return MockDynamic;
  },
}));

jest.mock('@/app/features/marketing/pages/AboutUs/AboutUs', () => ({
  __esModule: true,
  default: () => <div data-testid="route-about" />,
}));

jest.mock('@/app/features/marketing/pages/PetOwner/PetOwner', () => ({
  __esModule: true,
  default: () => <div data-testid="route-application" />,
}));

jest.mock('@/app/features/marketing/pages/BookDemo/BookDemo', () => ({
  __esModule: true,
  default: () => <div data-testid="route-book-demo" />,
}));

jest.mock('@/app/features/marketing/pages/ContactusPage/ContactusPage', () => ({
  __esModule: true,
  default: () => <div data-testid="route-contact-us" />,
}));

jest.mock('@/app/features/marketing/pages/DeveloperLanding/DeveloperLanding', () => ({
  __esModule: true,
  default: () => <div data-testid="route-developers" />,
}));

jest.mock('@/app/features/organizations/pages/Organizations', () => ({
  __esModule: true,
  default: () => <div data-testid="route-organizations" />,
}));

jest.mock('@/app/features/onboarding/pages/CreateOrg/CreateOrg', () => ({
  __esModule: true,
  default: () => <div data-testid="route-create-org" />,
}));

jest.mock('@/app/features/dashboard/pages/Dashboard', () => ({
  __esModule: true,
  default: () => <div data-testid="route-dashboard" />,
}));

jest.mock('@/app/features/marketing/pages/HomePage/HomePage', () => ({
  __esModule: true,
  default: () => <div data-testid="route-pms" />,
}));

jest.mock('@/app/features/marketing/pages/PricingPage/PricingPage', () => ({
  __esModule: true,
  default: () => <div data-testid="route-pricing" />,
}));

jest.mock('@/app/features/legal/pages/PrivacyPolicy', () => ({
  __esModule: true,
  default: () => <div data-testid="route-privacy-policy" />,
}));

jest.mock('@/app/features/legal/pages/TermsAndConditions', () => ({
  __esModule: true,
  default: () => <div data-testid="route-terms" />,
}));

jest.mock('@/app/features/legal/pages/DmcaCopyrightPolicy', () => ({
  __esModule: true,
  default: () => <div data-testid="route-dmca" />,
}));

jest.mock('@/app/ui/widgets/Footer/Footer', () => ({
  __esModule: true,
  default: () => <footer data-testid="route-footer" />,
}));

jest.mock('@/app/features/onboarding/pages/TeamOnboarding/TeamOnboarding', () => ({
  __esModule: true,
  default: () => <div data-testid="route-team-onboarding" />,
}));

import AboutUsRoute, * as AboutUsModule from '@/app/(routes)/(public)/about-us/page';
import AboutRedirectRoute from '@/app/(routes)/(public)/about/page';
import PetParentsRoute, * as PetParentsModule from '@/app/(routes)/(public)/pet-parents/page';
import ApplicationRedirectRoute from '@/app/(routes)/(public)/application/page';
import BookDemoRoute, * as BookDemoModule from '@/app/(routes)/(public)/book-demo/page';
import ContactUsRoute, * as ContactUsModule from '@/app/(routes)/(public)/contact-us/page';
import ContactRedirectRoute from '@/app/(routes)/(public)/contact/page';
import DevelopersRoute, * as DevelopersModule from '@/app/(routes)/(public)/developers/page';
import OrganizationsRoute, * as OrganizationsModule from '@/app/(routes)/(app)/organizations/page';
import CreateOrgRoute, * as CreateOrgModule from '@/app/(routes)/(app)/create-org/page';
import DashboardRoute, * as DashboardModule from '@/app/(routes)/(app)/dashboard/page';
import PetBusinessesRoute, * as PetBusinessesModule from '@/app/(routes)/(public)/pet-businesses/page';
import PmsRedirectRoute from '@/app/(routes)/(public)/pms/page';
import PricingRoute, * as PricingModule from '@/app/(routes)/(public)/pricing/page';
import PrivacyPolicyRoute, * as PrivacyPolicyModule from '@/app/(routes)/(public)/privacy-policy/page';
import TermsRoute, * as TermsModule from '@/app/(routes)/(public)/terms-and-conditions/page';
import DmcaRoute, * as DmcaModule from '@/app/(routes)/(public)/dmca/page';
import TeamOnboardingRoute, * as TeamOnboardingModule from '@/app/(routes)/(app)/team-onboarding/page';

type RouteCase = {
  name: string;
  RouteComponent: React.ComponentType;
  Module: { default: React.ComponentType };
  expectedTestIds: string[];
};

const routeCases: RouteCase[] = [
  {
    name: 'AboutUs',
    RouteComponent: AboutUsRoute,
    Module: AboutUsModule,
    expectedTestIds: ['route-about'],
  },
  {
    name: 'Application',
    RouteComponent: PetParentsRoute,
    Module: PetParentsModule,
    expectedTestIds: ['route-application'],
  },
  {
    name: 'Book Demo',
    RouteComponent: BookDemoRoute,
    Module: BookDemoModule,
    expectedTestIds: ['route-book-demo'],
  },
  {
    name: 'Contact us',
    RouteComponent: ContactUsRoute,
    Module: ContactUsModule,
    expectedTestIds: ['route-contact-us'],
  },
  {
    name: 'Developers',
    RouteComponent: DevelopersRoute,
    Module: DevelopersModule,
    expectedTestIds: ['route-developers'],
  },
  {
    name: 'Organizations',
    RouteComponent: OrganizationsRoute,
    Module: OrganizationsModule,
    expectedTestIds: ['route-organizations'],
  },
  {
    name: 'Create Org',
    RouteComponent: CreateOrgRoute,
    Module: CreateOrgModule,
    expectedTestIds: ['route-create-org'],
  },
  {
    name: 'Dashboard',
    RouteComponent: DashboardRoute,
    Module: DashboardModule,
    expectedTestIds: ['route-dashboard'],
  },
  {
    name: 'Pet Businesses',
    RouteComponent: PetBusinessesRoute,
    Module: PetBusinessesModule,
    expectedTestIds: ['route-pms'],
  },
  {
    name: 'Pricing',
    RouteComponent: PricingRoute,
    Module: PricingModule,
    expectedTestIds: ['route-pricing'],
  },
  {
    name: 'Privacy Policy',
    RouteComponent: PrivacyPolicyRoute,
    Module: PrivacyPolicyModule,
    expectedTestIds: ['route-privacy-policy'],
  },
  {
    name: 'Terms and Conditions',
    RouteComponent: TermsRoute,
    Module: TermsModule,
    expectedTestIds: ['route-terms', 'route-footer'],
  },
  {
    name: 'DMCA',
    RouteComponent: DmcaRoute,
    Module: DmcaModule,
    expectedTestIds: ['route-dmca', 'route-footer'],
  },
  {
    name: 'Team Onboarding',
    RouteComponent: TeamOnboardingRoute,
    Module: TeamOnboardingModule,
    expectedTestIds: ['route-team-onboarding'],
  },
];

describe('static route wrappers', () => {
  test.each(routeCases)('page (%s route)', ({ RouteComponent, Module, expectedTestIds }) => {
    render(<RouteComponent />);
    for (const testId of expectedTestIds) {
      expect(screen.getByTestId(testId)).toBeInTheDocument();
    }
    expect(typeof RouteComponent).toBe('function');
    expect(typeof Module.default).toBe('function');
  });

  test('contact route redirects to contact-us', () => {
    expect(() => ContactRedirectRoute()).toThrow('NEXT_REDIRECT');
  });

  test('pms route redirects to pet-businesses', () => {
    expect(() => PmsRedirectRoute()).toThrow('NEXT_REDIRECT');
  });

  test('about route redirects to about-us', () => {
    expect(() => AboutRedirectRoute()).toThrow('NEXT_REDIRECT');
  });

  test('application route redirects to pet-parents', () => {
    expect(() => ApplicationRedirectRoute()).toThrow('NEXT_REDIRECT');
  });
});
