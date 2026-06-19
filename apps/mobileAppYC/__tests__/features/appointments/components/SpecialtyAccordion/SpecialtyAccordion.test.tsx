import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {mockTheme} from '../../../../setup/mockTheme';
import {SpecialtyAccordion} from '../../../../../src/features/appointments/components/SpecialtyAccordion/SpecialtyAccordion';
import type {VetPackage} from '../../../../../src/features/appointments/types';

// --- Mocks ---

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

jest.mock('@/shared/components/common/LiquidGlassCard/LiquidGlassCard', () => ({
  LiquidGlassCard: ({children}: any) => {
    const {View} = require('react-native');
    return <View testID="liquid-glass-card">{children}</View>;
  },
}));

jest.mock(
  '@/shared/components/common/LiquidGlassButton/LiquidGlassButton',
  () => ({
    LiquidGlassButton: ({title, onPress}: any) => {
      const {TouchableOpacity, Text} = require('react-native');
      return (
        <TouchableOpacity testID="glass-button" onPress={onPress}>
          <Text>{title}</Text>
        </TouchableOpacity>
      );
    },
  }),
);

jest.mock('@/assets/images', () => ({
  Images: {
    specialityIcon: {uri: 'mock-speciality-icon'},
    downArrow: {uri: 'mock-down-arrow'},
  },
}));

jest.mock('@/shared/utils/currency', () => ({
  resolveCurrencySymbol: () => '$',
}));

// --- Test Data ---

const mockService = {
  id: 'svc-1',
  name: 'Vaccine',
  description: 'Annual vaccine',
  basePrice: 80,
  currency: 'USD',
};

const mockServiceNoPrice = {
  id: 'svc-2',
  name: 'Checkup',
};

const mockPackage: VetPackage = {
  id: 'pkg-1',
  businessId: 'biz-1',
  name: 'Canine Bundle',
  description: 'Full canine assessment.',
  totalPrice: 350,
  currency: 'USD',
  items: [
    {id: 'pi-1', name: 'Radiography', price: 200},
    {id: 'pi-2', name: 'Blood Test', price: 150},
  ],
};

const mockPackageNoCurrency: VetPackage = {
  id: 'pkg-nc',
  businessId: 'biz-1',
  name: 'No Currency Package',
  totalPrice: 100,
  items: [{id: 'pi-nc', name: 'Basic Service', price: 100}],
};

const onSelectService = jest.fn();
const onSelectPackage = jest.fn();

const singleSpecialty = [
  {
    name: 'General',
    serviceCount: 1,
    services: [mockService],
    packages: [],
  },
];

const specialtyWithPackages = [
  {
    name: 'Canine',
    serviceCount: 1,
    services: [mockService],
    packages: [mockPackage],
  },
];

const packagesOnlySpecialty = [
  {
    name: 'Feline',
    serviceCount: 0,
    services: [],
    packages: [mockPackage],
  },
];

// --- Tests ---

describe('SpecialtyAccordion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('header rendering', () => {
    it('renders title', () => {
      const {getByText} = render(
        <SpecialtyAccordion
          title="Specialties"
          specialties={singleSpecialty}
          onSelectService={onSelectService}
          onSelectPackage={onSelectPackage}
        />,
      );
      expect(getByText('Specialties')).toBeTruthy();
    });

    it('renders icon when provided', () => {
      const {getByTestId} = render(
        <SpecialtyAccordion
          title="Specialties"
          icon={{uri: 'mock-icon'}}
          specialties={singleSpecialty}
          onSelectService={onSelectService}
          onSelectPackage={onSelectPackage}
        />,
      );
      expect(getByTestId('parent-icon')).toBeTruthy();
    });

    it('does not render icon when not provided', () => {
      const {queryByTestId} = render(
        <SpecialtyAccordion
          title="Specialties"
          specialties={singleSpecialty}
          onSelectService={onSelectService}
          onSelectPackage={onSelectPackage}
        />,
      );
      expect(queryByTestId('parent-icon')).toBeNull();
    });
  });

  describe('specialty header', () => {
    it('shows specialty name in header', () => {
      const {getByText} = render(
        <SpecialtyAccordion
          title="Specialties"
          specialties={singleSpecialty}
          onSelectService={onSelectService}
          onSelectPackage={onSelectPackage}
        />,
      );
      expect(getByText('General')).toBeTruthy();
    });

    it('shows total count (services + packages) as a number', () => {
      const {getByText} = render(
        <SpecialtyAccordion
          title="Specialties"
          specialties={specialtyWithPackages}
          onSelectService={onSelectService}
          onSelectPackage={onSelectPackage}
        />,
      );
      // 1 service + 1 package = 2
      expect(getByText('2')).toBeTruthy();
    });

    it('shows count 0 when no services and no packages', () => {
      const {getByText} = render(
        <SpecialtyAccordion
          title="Specialties"
          specialties={[
            {name: 'Empty', serviceCount: 0, services: [], packages: []},
          ]}
          onSelectService={onSelectService}
          onSelectPackage={onSelectPackage}
        />,
      );
      expect(getByText('0')).toBeTruthy();
    });
  });

  describe('default expanded state', () => {
    it('first specialty is expanded by default and shows services', () => {
      const {getByText} = render(
        <SpecialtyAccordion
          title="Specialties"
          specialties={singleSpecialty}
          onSelectService={onSelectService}
          onSelectPackage={onSelectPackage}
        />,
      );
      expect(getByText('Vaccine')).toBeTruthy();
    });

    it('second specialty is collapsed by default and hides its services', () => {
      const {queryByText} = render(
        <SpecialtyAccordion
          title="Specialties"
          specialties={[
            {...singleSpecialty[0]},
            {
              name: 'Surgical',
              serviceCount: 1,
              services: [mockServiceNoPrice],
              packages: [],
            },
          ]}
          onSelectService={onSelectService}
          onSelectPackage={onSelectPackage}
        />,
      );
      expect(queryByText('Checkup')).toBeNull();
    });
  });

  describe('toggle expand/collapse', () => {
    it('pressing a collapsed specialty reveals its services', () => {
      const {getByText, queryByText} = render(
        <SpecialtyAccordion
          title="Specialties"
          specialties={[
            {...singleSpecialty[0]},
            {
              name: 'Surgical',
              serviceCount: 1,
              services: [mockServiceNoPrice],
              packages: [],
            },
          ]}
          onSelectService={onSelectService}
          onSelectPackage={onSelectPackage}
        />,
      );
      expect(queryByText('Checkup')).toBeNull();
      fireEvent.press(getByText('Surgical'));
      expect(getByText('Checkup')).toBeTruthy();
    });

    it('pressing an expanded specialty hides its content', () => {
      const {getByText, queryByText} = render(
        <SpecialtyAccordion
          title="Specialties"
          specialties={singleSpecialty}
          onSelectService={onSelectService}
          onSelectPackage={onSelectPackage}
        />,
      );
      expect(getByText('Vaccine')).toBeTruthy();
      fireEvent.press(getByText('General'));
      expect(queryByText('Vaccine')).toBeNull();
    });
  });

  describe('service card content', () => {
    it('shows service name', () => {
      const {getByText} = render(
        <SpecialtyAccordion
          title="Specialties"
          specialties={singleSpecialty}
          onSelectService={onSelectService}
          onSelectPackage={onSelectPackage}
        />,
      );
      expect(getByText('Vaccine')).toBeTruthy();
    });

    it('shows price chip when basePrice is present', () => {
      const {getByText} = render(
        <SpecialtyAccordion
          title="Specialties"
          specialties={singleSpecialty}
          onSelectService={onSelectService}
          onSelectPackage={onSelectPackage}
        />,
      );
      expect(getByText('$80')).toBeTruthy();
    });

    it('does not show price chip when basePrice is absent', () => {
      const {queryByText} = render(
        <SpecialtyAccordion
          title="Specialties"
          specialties={[
            {
              name: 'General',
              serviceCount: 1,
              services: [mockServiceNoPrice],
              packages: [],
            },
          ]}
          onSelectService={onSelectService}
          onSelectPackage={onSelectPackage}
        />,
      );
      expect(queryByText(/^\$/)).toBeNull();
    });

    it('shows description when present', () => {
      const {getByText} = render(
        <SpecialtyAccordion
          title="Specialties"
          specialties={singleSpecialty}
          onSelectService={onSelectService}
          onSelectPackage={onSelectPackage}
        />,
      );
      expect(getByText('Annual vaccine')).toBeTruthy();
    });

    it('does not show description when absent', () => {
      const {queryByText} = render(
        <SpecialtyAccordion
          title="Specialties"
          specialties={[
            {
              name: 'General',
              serviceCount: 1,
              services: [mockServiceNoPrice],
              packages: [],
            },
          ]}
          onSelectService={onSelectService}
          onSelectPackage={onSelectPackage}
        />,
      );
      expect(queryByText('Annual vaccine')).toBeNull();
    });

    it('calls onSelectService with correct args when Select service pressed', () => {
      const {getAllByText} = render(
        <SpecialtyAccordion
          title="Specialties"
          specialties={singleSpecialty}
          onSelectService={onSelectService}
          onSelectPackage={onSelectPackage}
        />,
      );
      fireEvent.press(getAllByText('Select service')[0]);
      expect(onSelectService).toHaveBeenCalledWith('svc-1', 'General');
    });
  });

  describe('inline package section', () => {
    it('renders Packages label and package name when specialty has packages', () => {
      const {getByText} = render(
        <SpecialtyAccordion
          title="Specialties"
          specialties={specialtyWithPackages}
          onSelectService={onSelectService}
          onSelectPackage={onSelectPackage}
        />,
      );
      expect(getByText('Packages')).toBeTruthy();
      expect(getByText('Canine Bundle')).toBeTruthy();
    });

    it('does not render Packages label when specialty has no packages', () => {
      const {queryByText} = render(
        <SpecialtyAccordion
          title="Specialties"
          specialties={singleSpecialty}
          onSelectService={onSelectService}
          onSelectPackage={onSelectPackage}
        />,
      );
      expect(queryByText('Packages')).toBeNull();
    });

    it('does not render divider when specialty has no services but has packages', () => {
      const {queryByText} = render(
        <SpecialtyAccordion
          title="Specialties"
          specialties={packagesOnlySpecialty}
          onSelectService={onSelectService}
          onSelectPackage={onSelectPackage}
        />,
      );
      expect(queryByText('Packages')).toBeTruthy();
    });

    it('shows package price chip in collapsed package header', () => {
      const {getAllByText} = render(
        <SpecialtyAccordion
          title="Specialties"
          specialties={specialtyWithPackages}
          onSelectService={onSelectService}
          onSelectPackage={onSelectPackage}
        />,
      );
      expect(getAllByText('$ 350.00').length).toBeGreaterThan(0);
    });

    it('expands a package and shows breakdown items', () => {
      const {getByText, queryByText} = render(
        <SpecialtyAccordion
          title="Specialties"
          specialties={specialtyWithPackages}
          onSelectService={onSelectService}
          onSelectPackage={onSelectPackage}
        />,
      );
      expect(queryByText('Radiography')).toBeNull();
      fireEvent.press(getByText('Canine Bundle'));
      expect(getByText('Radiography')).toBeTruthy();
      expect(getByText('Blood Test')).toBeTruthy();
    });

    it('shows Total cost label and value in expanded package', () => {
      const {getByText, getAllByText} = render(
        <SpecialtyAccordion
          title="Specialties"
          specialties={specialtyWithPackages}
          onSelectService={onSelectService}
          onSelectPackage={onSelectPackage}
        />,
      );
      fireEvent.press(getByText('Canine Bundle'));
      expect(getByText('Total cost')).toBeTruthy();
      expect(getAllByText('$ 350.00').length).toBeGreaterThanOrEqual(1);
    });

    it('shows description in expanded package when present', () => {
      const {getByText} = render(
        <SpecialtyAccordion
          title="Specialties"
          specialties={specialtyWithPackages}
          onSelectService={onSelectService}
          onSelectPackage={onSelectPackage}
        />,
      );
      fireEvent.press(getByText('Canine Bundle'));
      expect(getByText('Full canine assessment.')).toBeTruthy();
    });

    it('does not show description in expanded package when absent', () => {
      const pkgNoDesc: VetPackage = {
        ...mockPackage,
        id: 'pkg-nd',
        description: undefined,
      };
      const {getByText, queryByText} = render(
        <SpecialtyAccordion
          title="Specialties"
          specialties={[
            {
              name: 'Canine',
              serviceCount: 1,
              services: [mockService],
              packages: [pkgNoDesc],
            },
          ]}
          onSelectService={onSelectService}
          onSelectPackage={onSelectPackage}
        />,
      );
      fireEvent.press(getByText('Canine Bundle'));
      expect(queryByText('Full canine assessment.')).toBeNull();
    });

    it('collapses a package when header is pressed again', () => {
      const {getByText, queryByText} = render(
        <SpecialtyAccordion
          title="Specialties"
          specialties={specialtyWithPackages}
          onSelectService={onSelectService}
          onSelectPackage={onSelectPackage}
        />,
      );
      fireEvent.press(getByText('Canine Bundle'));
      expect(getByText('Radiography')).toBeTruthy();
      fireEvent.press(getByText('Canine Bundle'));
      expect(queryByText('Radiography')).toBeNull();
    });

    it('calls onSelectPackage with correct args when Select package pressed', () => {
      const {getByText, getAllByText} = render(
        <SpecialtyAccordion
          title="Specialties"
          specialties={specialtyWithPackages}
          onSelectService={onSelectService}
          onSelectPackage={onSelectPackage}
        />,
      );
      fireEvent.press(getByText('Canine Bundle'));
      fireEvent.press(getAllByText('Select package')[0]);
      expect(onSelectPackage).toHaveBeenCalledWith('pkg-1', 'Canine Bundle');
    });

    it('uses USD symbol fallback when package has no currency', () => {
      const {getByText, getAllByText} = render(
        <SpecialtyAccordion
          title="Specialties"
          specialties={[
            {
              name: 'General',
              serviceCount: 1,
              services: [mockService],
              packages: [mockPackageNoCurrency],
            },
          ]}
          onSelectService={onSelectService}
          onSelectPackage={onSelectPackage}
        />,
      );
      fireEvent.press(getByText('No Currency Package'));
      expect(getByText('Total cost')).toBeTruthy();
      expect(getAllByText('$ 100.00').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('android platform styles', () => {
    const {Platform} = require('react-native');
    const originalOS = Platform.OS;

    beforeEach(() => {
      (Platform as any).OS = 'android';
    });

    afterEach(() => {
      (Platform as any).OS = originalOS;
    });

    it('renders correctly on android', () => {
      const {getByText} = render(
        <SpecialtyAccordion
          title="Specialties"
          specialties={specialtyWithPackages}
          onSelectService={onSelectService}
          onSelectPackage={onSelectPackage}
        />,
      );
      expect(getByText('Specialties')).toBeTruthy();
    });

    it('renders package breakdown on android', () => {
      const {getByText} = render(
        <SpecialtyAccordion
          title="Specialties"
          specialties={specialtyWithPackages}
          onSelectService={onSelectService}
          onSelectPackage={onSelectPackage}
        />,
      );
      fireEvent.press(getByText('Canine Bundle'));
      expect(getByText('Total cost')).toBeTruthy();
    });
  });
});
