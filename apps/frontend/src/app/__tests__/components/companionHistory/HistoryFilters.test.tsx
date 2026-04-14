import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import HistoryFilters from '@/app/features/companionHistory/components/HistoryFilters';

jest.mock('@/app/ui/widgets/Labels/SubLabels', () => ({
  __esModule: true,
  default: ({ labels, activeLabel, setActiveLabel }: any) => (
    <div>
      <div data-testid="active-label">{activeLabel}</div>
      {labels.map((label: any) => (
        <button key={label.key} type="button" onClick={() => setActiveLabel(label.key)}>
          {label.name}
        </button>
      ))}
    </div>
  ),
}));

describe('HistoryFilters', () => {
  it('maps filter labels and calls onChange with selected key', () => {
    const onChange = jest.fn();
    render(
      <HistoryFilters
        filters={[{ key: 'all', label: 'All' } as any, { key: 'notes', label: 'Notes' } as any]}
        activeFilter={'all' as any}
        onChange={onChange}
      />
    );

    expect(screen.getByTestId('active-label')).toHaveTextContent('all');
    fireEvent.click(screen.getByRole('button', { name: 'Notes' }));
    expect(onChange).toHaveBeenCalledWith('notes');
  });
});
