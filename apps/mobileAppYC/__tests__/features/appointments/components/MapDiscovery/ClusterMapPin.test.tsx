import React from 'react';
import {render, screen} from '@testing-library/react-native';
import ClusterMapPin from '@/features/appointments/components/MapDiscovery/ClusterMapPin';

describe('ClusterMapPin', () => {
  it('renders the given count', () => {
    render(<ClusterMapPin count={5} />);
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('renders a different count value', () => {
    render(<ClusterMapPin count={42} />);
    expect(screen.getByText('42')).toBeTruthy();
  });

  it('renders zero as a valid count', () => {
    render(<ClusterMapPin count={0} />);
    expect(screen.getByText('0')).toBeTruthy();
  });
});
