import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import HistoryEntryCard from '@/app/features/companionHistory/components/HistoryEntryCard';
import { formatHistoryDateTime } from '@/app/features/companionHistory/utils/historyFormatters';

jest.mock('@/app/ui', () => ({
  Badge: ({ children }: any) => <span data-testid="status-badge">{children}</span>,
}));

jest.mock('@/app/features/companionHistory/utils/historyFormatters', () => ({
  formatHistoryDate: jest.fn(() => 'formatted-date'),
  formatHistoryDateTime: jest.fn(() => 'formatted-datetime'),
  getHistoryStatusBadgeTone: jest.fn(() => 'warning'),
  getPayloadString: jest.fn((payload: any, keys: string[]) => {
    const value = keys.map((k) => payload?.[k]).find((v) => v !== undefined);
    return typeof value === 'string' ? value : null;
  }),
  getPrimaryActionLabel: jest.fn(() => 'Open history entry'),
}));

const renderCard = (ui: React.ReactElement) =>
  render(ui, { wrapper: ({ children }: any) => <ul>{children}</ul> });

const baseEntry = {
  id: 'entry-1',
  type: 'TASK',
  occurredAt: '2026-01-01T10:00:00.000Z',
  status: 'IN_PROGRESS',
  title: 'Medication reminder',
  subtitle: 'Morning dose',
  summary: 'Give medicine with food',
  actor: { name: 'Dr Vet', role: 'VET' },
  tags: ['Important'],
  link: { kind: 'task', id: 'task-1', companionId: 'companion-1' },
  source: 'Manual',
  payload: { audience: 'Parent' },
} as any;

describe('HistoryEntryCard', () => {
  it('renders title, status badge, meta, subtitle, summary and opens on click', () => {
    const onOpen = jest.fn();
    renderCard(<HistoryEntryCard entry={baseEntry} onOpen={onOpen} />);

    expect(screen.getByText('Medication reminder')).toBeInTheDocument();
    // status badge derived from local formatStatusLabel('IN_PROGRESS')
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    // meta = "<datetime> · <contributor>" (contributor falls back to actor.name)
    expect(screen.getByText('formatted-datetime · Dr Vet')).toBeInTheDocument();
    expect(screen.getByText('Morning dose')).toBeInTheDocument();
    expect(screen.getByText('Give medicine with food')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open history entry' }));
    expect(onOpen).toHaveBeenCalledWith(baseEntry);
  });

  it('renders the interactive statusSlot instead of the default badge', () => {
    renderCard(
      <HistoryEntryCard
        entry={baseEntry}
        onOpen={jest.fn()}
        statusSlot={<span>editable-status</span>}
      />
    );

    expect(screen.getByText('editable-status')).toBeInTheDocument();
    expect(screen.queryByTestId('status-badge')).not.toBeInTheDocument();
  });

  it('renders action chips and expanded content when provided', () => {
    renderCard(
      <HistoryEntryCard
        entry={baseEntry}
        onOpen={jest.fn()}
        actions={<button type="button">custom-action</button>}
        expandedContent={<div>expanded-panel</div>}
      />
    );

    expect(screen.getByRole('button', { name: 'custom-action' })).toBeInTheDocument();
    expect(screen.getByText('expanded-panel')).toBeInTheDocument();
  });

  it('does not render a status badge when status is empty and uses the informational tint', () => {
    const noStatusEntry = { ...baseEntry, status: '' } as any;
    renderCard(<HistoryEntryCard entry={noStatusEntry} onOpen={jest.fn()} />);

    expect(screen.queryByTestId('status-badge')).not.toBeInTheDocument();
    // meta still renders without a trailing separator issue
    expect(screen.getByText('formatted-datetime · Dr Vet')).toBeInTheDocument();
  });

  it('renders per-type spine glyphs for every entry type without crashing', () => {
    const types = ['APPOINTMENT', 'TASK', 'FORM_SUBMISSION', 'DOCUMENT', 'LAB_RESULT', 'INVOICE'];
    types.forEach((type) => {
      const { unmount } = renderCard(
        <HistoryEntryCard entry={{ ...baseEntry, type }} onOpen={jest.fn()} />
      );
      expect(screen.getByText('Medication reminder')).toBeInTheDocument();
      unmount();
    });
  });

  it('renders attachment chips from fileName, attachments array and invoice number', () => {
    const entry = {
      ...baseEntry,
      payload: {
        fileName: 'Vaccination certificate.pdf',
        attachments: ['Consent · dental.pdf', { name: 'Discharge.pdf' }, { name: '' }, 42],
        invoiceNumber: '2038',
      },
    } as any;

    renderCard(<HistoryEntryCard entry={entry} onOpen={jest.fn()} />);

    expect(screen.getByText('Vaccination certificate.pdf')).toBeInTheDocument();
    expect(screen.getByText('Consent · dental.pdf')).toBeInTheDocument();
    expect(screen.getByText('Discharge.pdf')).toBeInTheDocument();
    expect(screen.getByText('Invoice #2038')).toBeInTheDocument();
  });

  it('ignores a non-array attachments payload value', () => {
    const entry = {
      ...baseEntry,
      payload: { attachments: 'not-an-array' },
    } as any;

    renderCard(<HistoryEntryCard entry={entry} onOpen={jest.fn()} />);
    expect(screen.getByText('Medication reminder')).toBeInTheDocument();
    // no attachment chip rendered from a string payload
    expect(screen.queryByText('not-an-array')).not.toBeInTheDocument();
  });

  it('threads the lead contributor from the payload into the meta line', () => {
    const entry = {
      ...baseEntry,
      actor: {},
      payload: { leadName: 'Dr Smith' },
    } as any;

    renderCard(<HistoryEntryCard entry={entry} onOpen={jest.fn()} />);
    expect(screen.getByText('formatted-datetime · Dr Smith')).toBeInTheDocument();
  });

  it('falls back to the actor role label when no name is present', () => {
    const entry = {
      ...baseEntry,
      actor: { name: '', role: 'PARENT' },
      payload: {},
    } as any;

    renderCard(<HistoryEntryCard entry={entry} onOpen={jest.fn()} />);
    expect(screen.getByText('formatted-datetime · Pet parent')).toBeInTheDocument();
  });

  it('renders only the timestamp when there is no contributor', () => {
    const entry = {
      ...baseEntry,
      actor: {},
      payload: {},
    } as any;

    renderCard(<HistoryEntryCard entry={entry} onOpen={jest.fn()} />);
    expect(screen.getByText('formatted-datetime')).toBeInTheDocument();
    expect(screen.queryByText(/·/)).not.toBeInTheDocument();
  });

  it('hides the subtitle when it duplicates the occurred date', () => {
    const entry = { ...baseEntry, subtitle: 'formatted-date' } as any;
    renderCard(<HistoryEntryCard entry={entry} onOpen={jest.fn()} />);

    const subtitleEls = document.querySelectorAll('.text-\\[12\\.5px\\]');
    const texts = Array.from(subtitleEls).map((el) => el.textContent);
    expect(texts).not.toContain('formatted-date');
  });

  it('strips a leading occurred-date prefix from the subtitle', () => {
    const entry = { ...baseEntry, subtitle: 'formatted-date • Follow-up visit' } as any;
    renderCard(<HistoryEntryCard entry={entry} onOpen={jest.fn()} />);
    expect(screen.getByText('Follow-up visit')).toBeInTheDocument();
  });

  it('keeps the raw subtitle when stripping reduces it to the occurred date', () => {
    const entry = { ...baseEntry, subtitle: 'formatted-date • formatted-date' } as any;
    renderCard(<HistoryEntryCard entry={entry} onOpen={jest.fn()} />);
    expect(screen.getByText('formatted-date • formatted-date')).toBeInTheDocument();
  });

  it('renders no subtitle line when subtitle is empty', () => {
    const entry = { ...baseEntry, subtitle: '' } as any;
    renderCard(<HistoryEntryCard entry={entry} onOpen={jest.fn()} />);
    expect(screen.queryByText('Morning dose')).not.toBeInTheDocument();
  });

  it('renders tags when present', () => {
    renderCard(<HistoryEntryCard entry={baseEntry} onOpen={jest.fn()} />);
    expect(screen.getByText('Important')).toBeInTheDocument();
  });

  it('does not render tags when the list is empty', () => {
    renderCard(<HistoryEntryCard entry={{ ...baseEntry, tags: [] }} onOpen={jest.fn()} />);
    expect(screen.queryByText('Important')).not.toBeInTheDocument();
  });

  it('does not render tags when the list is undefined', () => {
    renderCard(<HistoryEntryCard entry={{ ...baseEntry, tags: undefined }} onOpen={jest.fn()} />);
    expect(screen.queryByText('Important')).not.toBeInTheDocument();
  });

  it('does not render a summary line when summary is absent', () => {
    const entry = { ...baseEntry, summary: '' } as any;
    renderCard(<HistoryEntryCard entry={entry} onOpen={jest.fn()} />);
    expect(screen.queryByText('Give medicine with food')).not.toBeInTheDocument();
  });

  it('handles entries with undefined status and subtitle', () => {
    const entry = {
      ...baseEntry,
      status: undefined,
      subtitle: undefined,
    } as any;

    renderCard(<HistoryEntryCard entry={entry} onOpen={jest.fn()} />);
    expect(screen.getByText('Medication reminder')).toBeInTheDocument();
    expect(screen.queryByTestId('status-badge')).not.toBeInTheDocument();
  });

  it('omits the meta line when the timestamp resolves to empty', () => {
    (formatHistoryDateTime as jest.Mock).mockReturnValueOnce('');
    const entry = { ...baseEntry, actor: {}, payload: {} } as any;

    renderCard(<HistoryEntryCard entry={entry} onOpen={jest.fn()} />);
    expect(screen.getByText('Medication reminder')).toBeInTheDocument();
    // No meta span rendered at all (empty timestamp + no contributor)
    expect(screen.queryByText(/formatted-datetime/)).not.toBeInTheDocument();
  });

  it('renders a detail chevron that opens the record drawer when onOpenDetail is provided', () => {
    const onOpenDetail = jest.fn();
    renderCard(
      <HistoryEntryCard entry={baseEntry} onOpen={jest.fn()} onOpenDetail={onOpenDetail} active />
    );

    const chevron = screen.getByRole('button', {
      name: 'Open record detail for Medication reminder',
    });
    fireEvent.click(chevron);
    expect(onOpenDetail).toHaveBeenCalledWith(baseEntry);
  });

  it('does not render the detail chevron when onOpenDetail is absent', () => {
    renderCard(<HistoryEntryCard entry={baseEntry} onOpen={jest.fn()} />);
    expect(
      screen.queryByRole('button', { name: 'Open record detail for Medication reminder' })
    ).not.toBeInTheDocument();
  });
});
