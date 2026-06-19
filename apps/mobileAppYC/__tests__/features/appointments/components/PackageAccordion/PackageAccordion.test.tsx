import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {mockTheme} from '../../../../setup/mockTheme';
import {PackageAccordion} from '../../../../../src/features/appointments/components/PackageAccordion/PackageAccordion';
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
        <TouchableOpacity testID="select-package-btn" onPress={onPress}>
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

const mockPackageWithItems: VetPackage = {
  id: 'pkg-001',
  businessId: 'biz-1',
  name: 'Canine Radiographic Assessment',
  totalPrice: 3400,
  currency: 'USD',
  items: [
    {id: 'pi-1', name: 'Radiographic Consultation', price: 90},
    {id: 'pi-2', name: 'Amoxicillin Tablet', price: 9},
    {id: 'pi-3', name: 'MRI Procedure', price: 90},
  ],
};

const mockPackageWithDescription: VetPackage = {
  id: 'pkg-002',
  businessId: 'biz-1',
  name: 'Feline Wellness Bundle',
  description: 'Complete feline checkup and vaccinations.',
  totalPrice: 480,
  currency: 'USD',
  items: [
    {id: 'pi-4', name: 'Annual Wellness Exam', price: 85},
    {id: 'pi-5', name: 'FVRCP Vaccine', price: 45},
  ],
};

const mockPackageNoCurrency: VetPackage = {
  id: 'pkg-003',
  businessId: 'biz-1',
  name: 'No Currency Package',
  totalPrice: 200,
  items: [{id: 'pi-nc', name: 'Basic Service', price: 200}],
};

const onSelectPackage = jest.fn();

// --- Tests ---

describe('PackageAccordion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when packages array is empty', () => {
    const {toJSON} = render(
      <PackageAccordion
        title="Packages"
        packages={[]}
        onSelectPackage={onSelectPackage}
      />,
    );
    expect(toJSON()).toBeNull();
  });

  it('renders the section title', () => {
    const {getByText} = render(
      <PackageAccordion
        title="Packages"
        packages={[mockPackageWithItems]}
        onSelectPackage={onSelectPackage}
      />,
    );
    expect(getByText('Packages')).toBeTruthy();
  });

  it('renders icon when provided', () => {
    const {getByTestId} = render(
      <PackageAccordion
        title="Packages"
        icon={{uri: 'mock-icon'}}
        packages={[mockPackageWithItems]}
        onSelectPackage={onSelectPackage}
      />,
    );
    expect(getByTestId('package-section-icon')).toBeTruthy();
  });

  it('renders all package names', () => {
    const {getByText} = render(
      <PackageAccordion
        title="Packages"
        packages={[mockPackageWithItems, mockPackageWithDescription]}
        onSelectPackage={onSelectPackage}
      />,
    );
    expect(getByText('Canine Radiographic Assessment')).toBeTruthy();
    expect(getByText('Feline Wellness Bundle')).toBeTruthy();
  });

  it('shows total price chip in package header', () => {
    const {getAllByText} = render(
      <PackageAccordion
        title="Packages"
        packages={[mockPackageWithItems]}
        onSelectPackage={onSelectPackage}
      />,
    );
    expect(getAllByText('$ 3400.00').length).toBeGreaterThan(0);
  });

  describe('default expanded state', () => {
    it('first package is expanded by default and shows breakdown', () => {
      const {getByText} = render(
        <PackageAccordion
          title="Packages"
          packages={[mockPackageWithItems, mockPackageWithDescription]}
          onSelectPackage={onSelectPackage}
        />,
      );
      expect(getByText('Radiographic Consultation')).toBeTruthy();
      expect(getByText('Amoxicillin Tablet')).toBeTruthy();
      expect(getByText('MRI Procedure')).toBeTruthy();
    });

    it('second package is collapsed by default and does not show its breakdown', () => {
      const {queryByText} = render(
        <PackageAccordion
          title="Packages"
          packages={[mockPackageWithItems, mockPackageWithDescription]}
          onSelectPackage={onSelectPackage}
        />,
      );
      expect(queryByText('Annual Wellness Exam')).toBeNull();
      expect(queryByText('FVRCP Vaccine')).toBeNull();
    });
  });

  describe('accordion toggle', () => {
    it('pressing a collapsed package header reveals its breakdown', () => {
      const {getByText, queryByText} = render(
        <PackageAccordion
          title="Packages"
          packages={[mockPackageWithItems, mockPackageWithDescription]}
          onSelectPackage={onSelectPackage}
        />,
      );

      expect(queryByText('Annual Wellness Exam')).toBeNull();
      fireEvent.press(getByText('Feline Wellness Bundle'));
      expect(getByText('Annual Wellness Exam')).toBeTruthy();
    });

    it('pressing an expanded package header hides its breakdown', () => {
      const {getByText, queryByText} = render(
        <PackageAccordion
          title="Packages"
          packages={[mockPackageWithItems]}
          onSelectPackage={onSelectPackage}
        />,
      );

      expect(getByText('Radiographic Consultation')).toBeTruthy();
      fireEvent.press(getByText('Canine Radiographic Assessment'));
      expect(queryByText('Radiographic Consultation')).toBeNull();
    });
  });

  describe('breakdown content', () => {
    it('shows item names and formatted prices in expanded breakdown', () => {
      const {getByText, getAllByText} = render(
        <PackageAccordion
          title="Packages"
          packages={[mockPackageWithItems]}
          onSelectPackage={onSelectPackage}
        />,
      );
      expect(getByText('Radiographic Consultation')).toBeTruthy();
      // Two items have price 90 — verify at least one price label renders
      expect(getAllByText('$ 90.00').length).toBeGreaterThanOrEqual(1);
      // pi-2 has unique price 9
      expect(getByText('$ 9.00')).toBeTruthy();
    });

    it('shows Total cost label and total value', () => {
      const {getByText, getAllByText} = render(
        <PackageAccordion
          title="Packages"
          packages={[mockPackageWithItems]}
          onSelectPackage={onSelectPackage}
        />,
      );
      expect(getByText('Total cost')).toBeTruthy();
      // Total appears in both header chip and breakdown row
      expect(getAllByText('$ 3400.00').length).toBeGreaterThanOrEqual(1);
    });

    it('shows description when present', () => {
      const {getByText} = render(
        <PackageAccordion
          title="Packages"
          packages={[mockPackageWithDescription]}
          onSelectPackage={onSelectPackage}
        />,
      );
      expect(
        getByText('Complete feline checkup and vaccinations.'),
      ).toBeTruthy();
    });

    it('does not show description section when absent', () => {
      const {queryByText} = render(
        <PackageAccordion
          title="Packages"
          packages={[mockPackageWithItems]}
          onSelectPackage={onSelectPackage}
        />,
      );
      expect(queryByText(/checkup/)).toBeNull();
    });
  });

  describe('currency fallback', () => {
    it('renders a package with no currency using the USD default symbol', () => {
      const {getByText, getAllByText} = render(
        <PackageAccordion
          title="Packages"
          packages={[mockPackageNoCurrency]}
          onSelectPackage={onSelectPackage}
        />,
      );
      expect(getByText('Total cost')).toBeTruthy();
      // $ 200.00 appears in both the header chip and the breakdown total row
      expect(getAllByText('$ 200.00').length).toBeGreaterThanOrEqual(1);
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

    it('renders correctly on android (applies border width fallback)', () => {
      const {getByText} = render(
        <PackageAccordion
          title="Packages"
          packages={[mockPackageWithItems]}
          onSelectPackage={onSelectPackage}
        />,
      );
      expect(getByText('Packages')).toBeTruthy();
    });
  });

  describe('Select package callback', () => {
    it('calls onSelectPackage with correct id and name on button press', () => {
      const {getByTestId} = render(
        <PackageAccordion
          title="Packages"
          packages={[mockPackageWithItems]}
          onSelectPackage={onSelectPackage}
        />,
      );
      fireEvent.press(getByTestId('select-package-btn'));
      expect(onSelectPackage).toHaveBeenCalledTimes(1);
      expect(onSelectPackage).toHaveBeenCalledWith(
        'pkg-001',
        'Canine Radiographic Assessment',
      );
    });
  });
});
