import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import HistoryRecordDrawer from '@/app/features/companionHistory/components/HistoryRecordDrawer';
import { formatHistoryDateTime } from '@/app/features/companionHistory/utils/historyFormatters';

jest.mock('@/app/features/companionHistory/utils/historyFormatters', () => ({
  formatHistoryDateTime: jest.fn(() => 'formatted-datetime'),
}));

const baseEntry = {
  id: 'entry-1',
  type: 'LAB_RESULT',
  occurredAt: '2026-07-10T09:22:00.000Z',
  title: 'Catalyst Chem 17 + CBC',
  subtitle: 'IDEXX in-house',
  summary: 'Dr. Weber: Mild ALP elevation, likely benign.',
  link: { kind: 'lab_result', id: 'l-1', appointmentId: 'a-1' },
  source: 'LAB',
  payload: {},
} as any;

const buildProps = (overrides: Record<string, unknown> = {}) => ({
  entry: baseEntry,
  results: [
    { label: 'ALT', value: '48', range: '10-125' },
    { label: 'ALP', value: '212', range: '23-212', abnormal: true, direction: '↑' },
    { label: 'HCT', value: '' },
  ],
  linkedLabel: 'Annual check-up',
  onClose: jest.fn(),
  onDownload: jest.fn(),
  onOpenLinked: jest.fn(),
  onShare: jest.fn(),
  onDiscuss: jest.fn(),
  ...overrides,
});

describe('HistoryRecordDrawer', () => {
  beforeEach(() => {
    (formatHistoryDateTime as jest.Mock).mockReset().mockReturnValue('formatted-datetime');
  });

  it('renders nothing when there is no selected entry', () => {
    const { container } = render(<HistoryRecordDrawer {...buildProps({ entry: null })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the full record detail with results, note and linked appointment', () => {
    render(<HistoryRecordDrawer {...buildProps()} />);

    expect(screen.getByRole('dialog', { name: /Catalyst Chem 17/ })).toBeInTheDocument();
    expect(screen.getByText('Record detail')).toBeInTheDocument();
    expect(screen.getByText('Catalyst Chem 17 + CBC')).toBeInTheDocument();
    expect(screen.getByText('formatted-datetime')).toBeInTheDocument();

    // Analyte / Result / Range table with an empty-cell fallback
    expect(screen.getByText('Analyte')).toBeInTheDocument();
    expect(screen.getByText('Result')).toBeInTheDocument();
    expect(screen.getByText('Range')).toBeInTheDocument();
    expect(screen.getByText('ALT')).toBeInTheDocument();
    expect(screen.getByText('48')).toBeInTheDocument();
    expect(screen.getByText('10-125')).toBeInTheDocument();
    // The flagged analyte carries the direction arrow and the warn tint
    const flagged = screen.getByText('ALP ↑');
    expect(flagged).toBeInTheDocument();
    expect(flagged.closest('div')).toHaveStyle({ background: 'var(--warn-bg)' });
    // The rangeless, valueless row falls back to a dash in both cells
    expect(screen.getByText('HCT')).toBeInTheDocument();
    expect(screen.getAllByText('-')).toHaveLength(2);

    // Note + linked row
    expect(screen.getByText('Dr. Weber: Mild ALP elevation, likely benign.')).toBeInTheDocument();
    expect(screen.getByText('Linked to')).toBeInTheDocument();
    expect(screen.getByText('Annual check-up')).toBeInTheDocument();
  });

  it('fires every action callback with the entry', () => {
    const props = buildProps();
    render(<HistoryRecordDrawer {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
    expect(props.onDownload).toHaveBeenCalledWith(baseEntry);

    fireEvent.click(screen.getByRole('button', { name: 'Share to app' }));
    expect(props.onShare).toHaveBeenCalledWith(baseEntry);

    fireEvent.click(screen.getByRole('button', { name: 'Discuss in chat' }));
    expect(props.onDiscuss).toHaveBeenCalledWith(baseEntry);

    fireEvent.click(screen.getByText('Annual check-up'));
    expect(props.onOpenLinked).toHaveBeenCalledWith(baseEntry);

    fireEvent.click(screen.getByRole('button', { name: 'Close record detail' }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on backdrop click but not when the panel is clicked', () => {
    const props = buildProps();
    render(<HistoryRecordDrawer {...props} />);

    fireEvent.click(screen.getByRole('dialog'));
    expect(props.onClose).not.toHaveBeenCalled();

    const backdrop = document.querySelector('[data-history-record-drawer="true"]') as HTMLElement;
    fireEvent.click(backdrop);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('falls back to the subtitle when there is no summary and hides empty sections', () => {
    render(
      <HistoryRecordDrawer
        {...buildProps({
          entry: { ...baseEntry, summary: '   ' },
          results: [],
          linkedLabel: null,
        })}
      />
    );

    // subtitle used as the note when summary is blank
    expect(screen.getByText('IDEXX in-house')).toBeInTheDocument();
    // no results table, no linked row
    expect(screen.queryByText('Analyte')).not.toBeInTheDocument();
    expect(screen.queryByText('Linked to')).not.toBeInTheDocument();
  });

  it('omits the note block and meta line when both are empty', () => {
    (formatHistoryDateTime as jest.Mock).mockReturnValue('');
    render(
      <HistoryRecordDrawer
        {...buildProps({
          entry: { ...baseEntry, summary: '', subtitle: '' },
          results: [],
          linkedLabel: null,
        })}
      />
    );

    expect(screen.queryByText('formatted-datetime')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Dr. Weber: Mild ALP elevation, likely benign.')
    ).not.toBeInTheDocument();
  });
});
