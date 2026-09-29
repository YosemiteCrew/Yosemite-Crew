import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MedicationHistoryStatus from '@/app/features/appointments/pages/AppointmentWorkspace/components/MedicationHistoryStatus';

const renderStatus = (props: Partial<React.ComponentProps<typeof MedicationHistoryStatus>> = {}) =>
  render(
    <MedicationHistoryStatus
      ready
      isLoading={false}
      isEmpty={false}
      error={null}
      canRefresh={false}
      isBusy={false}
      onRefresh={jest.fn()}
      {...props}
    />
  );

describe('MedicationHistoryStatus', () => {
  it('waits for the inpatient record instead of reporting an empty history', () => {
    renderStatus({ ready: false, isEmpty: true });

    expect(
      screen.getByText('Medication history will be available once the inpatient record is loaded.')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('No medication doses are scheduled for this inpatient stay.')
    ).not.toBeInTheDocument();
  });

  it('announces the load and holds back the empty state', () => {
    renderStatus({ isLoading: true, isEmpty: true });

    expect(screen.getByRole('status')).toHaveTextContent('Loading medication history…');
    expect(
      screen.queryByText('No medication doses are scheduled for this inpatient stay.')
    ).not.toBeInTheDocument();
  });

  it('reports an empty history once the load finishes', () => {
    renderStatus({ isEmpty: true });

    expect(
      screen.getByText('No medication doses are scheduled for this inpatient stay.')
    ).toBeInTheDocument();
  });

  it('shows nothing at all when doses are on screen', () => {
    renderStatus();

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('offers a reload when reloading is the fix', async () => {
    const onRefresh = jest.fn();
    renderStatus({
      error: 'Unable to record this outcome. Refresh the history to see its current state.',
      canRefresh: true,
      onRefresh,
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Unable to record this outcome.');
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    expect(onRefresh).toHaveBeenCalled();
  });

  it('shows a failure that no reload can fix without offering one', () => {
    renderStatus({ error: 'Unable to schedule this dose. Please try again.' });

    expect(screen.getByRole('alert')).toHaveTextContent('Unable to schedule this dose.');
    expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument();
  });

  it('blocks the reload while a write is in flight', () => {
    renderStatus({ error: 'Unable to load medication history.', canRefresh: true, isBusy: true });

    expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled();
  });
});
