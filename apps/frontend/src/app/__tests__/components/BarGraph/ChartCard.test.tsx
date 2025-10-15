import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ChartCard from '@/app/components/BarGraph/ChartCard';

let passedProps: any = {};

jest.mock('react-chartjs-2', () => ({
  Line: (props: any) => {
    passedProps = props;
    return <div data-testid="mock-line-chart" />;
  },
}));

describe('ChartCard Component', () => {
  beforeEach(() => {
    passedProps = {};
    render(<ChartCard />);
  });

  test('should render the line chart and chat button', () => {
    expect(screen.getByTestId('mock-line-chart')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Chat/i })).toBeInTheDocument();
  });

  test('should pass the correct data and options props to the Line component', () => {
    expect(passedProps.data.labels).toEqual(['March', 'April', 'May', 'June', 'July', 'August']);
    expect(passedProps.options.plugins.legend.display).toBe(false);
    expect(passedProps.height).toBe(170);
  });

  describe('Chart Options Tick Callback', () => {
    test('should format y-axis ticks correctly', () => {
      const tickCallback = passedProps.options.scales.y.ticks.callback;

      expect(tickCallback(0)).toBe('$0');
      expect(tickCallback(4000)).toBe('$4K');
      expect(tickCallback(20000)).toBe('$20K');
      expect(tickCallback('8000')).toBe('$8K'); 
    });
  });
});