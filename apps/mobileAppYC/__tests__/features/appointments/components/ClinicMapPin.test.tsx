import React from 'react';
import {render, screen} from '@testing-library/react-native';
import ClinicMapPin from '../../../../src/features/appointments/components/MapDiscovery/ClinicMapPin';
import type {VetBusiness} from '../../../../src/features/appointments/types';

const makeClinic = (overrides: Partial<VetBusiness> = {}): VetBusiness => ({
  id: 'clinic_test',
  name: 'Pacific Animal Center',
  category: 'hospital',
  address: '600 Alabama St',
  lat: 37.757,
  lng: -122.41,
  rating: 4.8,
  ...overrides,
});

describe('ClinicMapPin', () => {
  it('renders clinic name when it is short enough', () => {
    render(
      <ClinicMapPin
        business={makeClinic({name: 'Short Name'})}
        isSelected={false}
      />,
    );
    expect(screen.getByText('Short Name')).toBeTruthy();
  });

  it('truncates names longer than 13 characters', () => {
    render(
      <ClinicMapPin
        business={makeClinic({
          name: 'A Very Long Clinic Name That Exceeds Limit',
        })}
        isSelected={false}
      />,
    );
    expect(screen.getByText('A Very Long C…')).toBeTruthy();
  });

  it('shows rating when available', () => {
    render(
      <ClinicMapPin business={makeClinic({rating: 4.8})} isSelected={false} />,
    );
    expect(screen.getByText('4.8')).toBeTruthy();
  });

  it('shows category symbol when rating is absent', () => {
    render(
      <ClinicMapPin
        business={makeClinic({rating: undefined})}
        isSelected={false}
      />,
    );
    expect(screen.getByText('🏥')).toBeTruthy();
  });

  it('shows groomer symbol when category is groomer and no rating', () => {
    render(
      <ClinicMapPin
        business={makeClinic({category: 'groomer', rating: undefined})}
        isSelected={false}
      />,
    );
    expect(screen.getByText('✂️')).toBeTruthy();
  });

  it('renders without error when not selected', () => {
    expect(() =>
      render(<ClinicMapPin business={makeClinic()} isSelected={false} />),
    ).not.toThrow();
  });

  it('renders without error when selected', () => {
    expect(() =>
      render(<ClinicMapPin business={makeClinic()} isSelected />),
    ).not.toThrow();
  });

  it('falls back to bullet symbol for an unrecognised category', () => {
    render(
      <ClinicMapPin
        business={makeClinic({
          category: 'unknown_cat' as any,
          rating: undefined,
        })}
        isSelected={false}
      />,
    );
    expect(screen.getByText('•')).toBeTruthy();
  });

  it('falls back to primary blue colour for an unrecognised category without crashing', () => {
    expect(() =>
      render(
        <ClinicMapPin
          business={makeClinic({category: 'unknown_cat' as any, rating: 4.0})}
          isSelected={false}
        />,
      ),
    ).not.toThrow();
  });

  it('renders for all business categories without throwing', () => {
    const categories: VetBusiness['category'][] = [
      'hospital',
      'groomer',
      'breeder',
      'boarder',
      'pet_center',
    ];
    categories.forEach(category => {
      expect(() =>
        render(
          <ClinicMapPin
            business={makeClinic({category, rating: undefined})}
            isSelected={false}
          />,
        ),
      ).not.toThrow();
    });
  });

  it('renders consistently when name is exactly 13 characters', () => {
    const exactName = 'A'.repeat(13);
    render(
      <ClinicMapPin
        business={makeClinic({name: exactName})}
        isSelected={false}
      />,
    );
    expect(screen.getByText(exactName)).toBeTruthy();
  });

  it('snapshot matches for unselected state', () => {
    const {toJSON} = render(
      <ClinicMapPin business={makeClinic()} isSelected={false} />,
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('snapshot matches for selected state', () => {
    const {toJSON} = render(
      <ClinicMapPin business={makeClinic()} isSelected />,
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
