import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import BlankDonutCard from '@/app/components/BarGraph/BlankDonutCard';

const mockProps = {
  title: 'Weekly Pet Appointments',
  labels: [
    { text: 'Dogs', value: 15 },
    { text: 'Cats', value: 10 },
    { text: 'Birds', value: 5 },
  ],
};

describe('BlankDonutCard Component', () => {

  test('should render the title and all labels correctly', () => {
    render(<BlankDonutCard title={mockProps.title} labels={mockProps.labels} />);

    expect(
      screen.getByRole('heading', { name: 'Weekly Pet Appointments' })
    ).toBeInTheDocument();

    expect(screen.getByText(/Pet Per Week/i)).toBeInTheDocument();

    for (const label of mockProps.labels) {
      expect(screen.getByText(label.text)).toBeInTheDocument();
    }

    const zeroValueElements = screen.getAllByText('00');
    expect(zeroValueElements).toHaveLength(mockProps.labels.length + 1);
  });

  test('should render correctly when the labels array is empty', () => {
    render(<BlankDonutCard title="No Data Available" labels={[]} />);

    expect(screen.getByRole('heading', { name: 'No Data Available' })).toBeInTheDocument();

    expect(screen.getByText(/Pet Per Week/i)).toBeInTheDocument();

    expect(screen.queryByText('Dogs')).not.toBeInTheDocument();
    expect(screen.queryByText('Cats')).not.toBeInTheDocument();

    const zeroValueElements = screen.getAllByText('00');
    expect(zeroValueElements).toHaveLength(1);
  });
});