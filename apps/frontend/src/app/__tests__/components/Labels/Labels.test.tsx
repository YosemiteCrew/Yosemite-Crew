import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Labels from '@/app/ui/widgets/Labels/Labels';

describe('Labels', () => {
  const labels = [
    {
      key: 'details',
      name: 'Details',
      labels: [
        { key: 'core', name: 'Core' },
        { key: 'history', name: 'History' },
      ],
    },
    { key: 'documents', name: 'Documents', labels: [] },
  ];

  it('renders main labels and sublabels for active label', () => {
    render(
      <Labels
        labels={labels}
        activeLabel="details"
        setActiveLabel={jest.fn()}
        activeSubLabel="core"
        setActiveSubLabel={jest.fn()}
      />
    );

    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.getByText('Documents')).toBeInTheDocument();
    expect(screen.getByText('Core')).toBeInTheDocument();
    expect(screen.getByText('History')).toBeInTheDocument();
  });

  it('calls setActiveLabel when clicking a label', () => {
    const setActiveLabel = jest.fn();
    render(
      <Labels
        labels={labels}
        activeLabel="details"
        setActiveLabel={setActiveLabel}
        activeSubLabel="core"
        setActiveSubLabel={jest.fn()}
      />
    );

    fireEvent.click(screen.getByText('Documents'));
    expect(setActiveLabel).toHaveBeenCalledWith('documents');
  });

  it('uses a padded left-aligned scroll row for labels', () => {
    const longLabels = [
      ...labels,
      { key: 'labs', name: 'Labs', labels: [] },
      { key: 'finance', name: 'Finance', labels: [] },
    ];

    render(
      <Labels
        labels={longLabels}
        activeLabel="details"
        setActiveLabel={jest.fn()}
        activeSubLabel="core"
        setActiveSubLabel={jest.fn()}
      />
    );

    expect(screen.getByRole('tablist', { name: 'Section navigation' })).toHaveClass(
      'justify-start',
      'px-1'
    );
  });

  it('keeps short label rows centered', () => {
    render(
      <Labels
        labels={labels}
        activeLabel="details"
        setActiveLabel={jest.fn()}
        activeSubLabel="core"
        setActiveSubLabel={jest.fn()}
      />
    );

    expect(screen.getByRole('tablist', { name: 'Section navigation' })).toHaveClass(
      'justify-center'
    );
  });

  it('distinguishes a valid section from a failed one by shape, not only hue', () => {
    render(
      <Labels
        labels={labels}
        activeLabel="details"
        setActiveLabel={jest.fn()}
        activeSubLabel="core"
        setActiveSubLabel={jest.fn()}
        statuses={{ details: 'valid', documents: 'error' }}
      />
    );

    // --success and --danger differ by 0.0005 in relative luminance, so two
    // coloured dots were indistinguishable in greyscale and to a red-green
    // colourblind user. The states must carry accessible names too.
    expect(screen.getByLabelText('Section complete')).toBeInTheDocument();
    expect(screen.getByLabelText('Section has errors')).toBeInTheDocument();
    expect(screen.queryByText('•')).not.toBeInTheDocument();
  });

  it('marks no section when no statuses are supplied', () => {
    render(
      <Labels
        labels={labels}
        activeLabel="details"
        setActiveLabel={jest.fn()}
        activeSubLabel="core"
        setActiveSubLabel={jest.fn()}
      />
    );

    expect(screen.queryByLabelText('Section complete')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Section has errors')).not.toBeInTheDocument();
  });
});
