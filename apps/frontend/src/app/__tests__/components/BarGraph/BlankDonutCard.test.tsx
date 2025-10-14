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

    // Check if the title is rendered as a heading
    expect(
      screen.getByRole('heading', { name: 'Weekly Pet Appointments' })
    ).toBeInTheDocument();

    // Check for the static "Pet Per Week" text element
    expect(screen.getByText(/Pet Per Week/i)).toBeInTheDocument();

    // Verify that each label text from the props is rendered on the screen
    mockProps.labels.forEach((label) => {
      expect(screen.getByText(label.text)).toBeInTheDocument();
    });

    // The component consistently displays "00" for all dynamic and static values.
    // We expect to find one "00" for "Pet Per Week" and one for each label.
    const zeroValueElements = screen.getAllByText('00');
    expect(zeroValueElements).toHaveLength(mockProps.labels.length + 1);
  });

  /**
   * Test case 2: Verifies that the component handles an empty labels array gracefully
   * without crashing or rendering incorrect elements.
   */
  test('should render correctly when the labels array is empty', () => {
    render(<BlankDonutCard title="No Data Available" labels={[]} />);

    // The title should still be rendered
    expect(screen.getByRole('heading', { name: 'No Data Available' })).toBeInTheDocument();

    // The static text should also be present
    expect(screen.getByText(/Pet Per Week/i)).toBeInTheDocument();

    // Ensure no label text from the previous test is accidentally rendered
    expect(screen.queryByText('Dogs')).not.toBeInTheDocument();
    expect(screen.queryByText('Cats')).not.toBeInTheDocument();

    // With an empty labels array, only the "Pet Per Week" value should be displayed
    const zeroValueElements = screen.getAllByText('00');
    expect(zeroValueElements).toHaveLength(1);
  });
});