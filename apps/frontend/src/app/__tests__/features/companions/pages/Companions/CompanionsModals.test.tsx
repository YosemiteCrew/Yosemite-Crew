import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { CompanionParent } from '@/app/features/companions/pages/Companions/types';

const isCompanionRevampEnabledMock = jest.fn();

jest.mock('@/app/lib/featureFlags', () => ({
  isCompanionRevampEnabled: () => isCompanionRevampEnabledMock(),
}));

// Every modal in the stack is a `next/dynamic` import. Label each stub from its
// loader source so the test can assert which gate rendered which modal, and let
// the stub replay the callback props back to the caller — that is the only way
// the no-op filter/status handlers on the revamp appointment modal are reached.
// The label table lives inside the factory: a module-scope const would still be
// in its TDZ when jest hoists this mock above the imports.
jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: (loader: () => Promise<unknown>) => {
    // Longest match first: 'AddCompanionCentralModal' contains 'AddCompanion'.
    const labels: Array<[string, string]> = [
      ['AddCompanionCentralModal', 'central-companion'],
      ['AddAppointmentCentralModal', 'central-appointment'],
      ['m.CompanionInfo', 'companion-info'],
      ['BookAppointment', 'book-appointment'],
      ['ChangeStatus', 'change-status'],
      ['AddTask', 'add-task'],
      ['components/AddCompanion', 'add-companion'],
    ];
    const source = loader.toString();
    const label = labels.find(([needle]) => source.includes(needle))?.[1] ?? 'unknown';
    const Stub = (props: Record<string, unknown>) => (
      <div data-testid={label} data-open={String(props.showModal)}>
        <button
          type="button"
          onClick={() => {
            (props.setActiveFilter as (() => void) | undefined)?.();
            (props.setActiveStatus as (() => void) | undefined)?.();
            (props.setShowModal as ((next: boolean) => void) | undefined)?.(false);
          }}
        >
          {`replay ${label}`}
        </button>
        <span data-testid={`${label}-detail`}>
          {[props.initialLabel, props.initialCompanionId, String(props.canEditCompanionStatus)]
            .filter((value) => value !== undefined)
            .join('|')}
        </span>
      </div>
    );
    Stub.displayName = 'MockDynamicComponent';
    return Stub;
  },
}));

import CompanionsModals from '@/app/features/companions/pages/Companions/CompanionsModals';

const companion = {
  companion: { id: 'c1', name: 'Buddy' },
  parent: { id: 'p1', firstName: 'Sam' },
} as unknown as CompanionParent;

const setAddPopup = jest.fn();
const setViewCompanion = jest.fn();
const setChangeStatusPopup = jest.fn();
const setBookAppointment = jest.fn();
const setAddTask = jest.fn();

const renderModals = (overrides: Partial<React.ComponentProps<typeof CompanionsModals>> = {}) =>
  render(
    <CompanionsModals
      activeCompanion={companion}
      addPopup
      setAddPopup={setAddPopup}
      viewCompanion
      setViewCompanion={setViewCompanion}
      companionInfoInitialLabel="history"
      changeStatusPopup
      setChangeStatusPopup={setChangeStatusPopup}
      bookAppointment
      setBookAppointment={setBookAppointment}
      addTask
      setAddTask={setAddTask}
      canEditCompanions
      canEditAppointments
      canEditTasks
      {...overrides}
    />
  );

describe('CompanionsModals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    isCompanionRevampEnabledMock.mockReturnValue(false);
  });

  describe('legacy stack', () => {
    it('renders the legacy add/info modals and every permitted action modal', () => {
      renderModals();

      expect(screen.getByTestId('add-companion')).toBeInTheDocument();
      expect(screen.getByTestId('companion-info')).toBeInTheDocument();
      expect(screen.getByTestId('companion-info-detail')).toHaveTextContent('history|true');
      expect(screen.getByTestId('change-status')).toBeInTheDocument();
      expect(screen.getByTestId('book-appointment')).toBeInTheDocument();
      expect(screen.getByTestId('add-task')).toBeInTheDocument();
      expect(screen.queryByTestId('central-companion')).not.toBeInTheDocument();
      expect(screen.queryByTestId('central-appointment')).not.toBeInTheDocument();
    });

    it('keeps the companion info modal closed until the view flag is set', () => {
      renderModals({ viewCompanion: false });

      expect(screen.queryByTestId('companion-info')).not.toBeInTheDocument();
      expect(screen.getByTestId('add-companion')).toBeInTheDocument();
    });

    it('threads the setter through so a modal can close itself', () => {
      renderModals();

      fireEvent.click(screen.getByText('replay add-companion'));
      expect(setAddPopup).toHaveBeenCalledWith(false);
    });
  });

  describe('revamp stack', () => {
    beforeEach(() => {
      isCompanionRevampEnabledMock.mockReturnValue(true);
    });

    it('swaps in the two central companion modals and the central appointment modal', () => {
      renderModals();

      expect(screen.getAllByTestId('central-companion')).toHaveLength(2);
      expect(screen.getByTestId('central-appointment')).toBeInTheDocument();
      expect(screen.getByTestId('central-appointment-detail')).toHaveTextContent('c1');
      expect(screen.queryByTestId('add-companion')).not.toBeInTheDocument();
      expect(screen.queryByTestId('book-appointment')).not.toBeInTheDocument();
    });

    it('opens the viewing central modal only when a companion is being viewed', () => {
      renderModals({ viewCompanion: false });

      const openStates = screen
        .getAllByTestId('central-companion')
        .map((node) => node.getAttribute('data-open'));
      expect(openStates).toEqual(['true', 'false']);
    });

    it('passes inert filter and status setters to the central appointment modal', () => {
      renderModals();

      expect(() => fireEvent.click(screen.getByText('replay central-appointment'))).not.toThrow();
      expect(setBookAppointment).toHaveBeenCalledWith(false);
    });
  });

  describe('gating', () => {
    it('renders no companion-scoped modal without an active companion', () => {
      renderModals({ activeCompanion: null });

      expect(screen.queryByTestId('companion-info')).not.toBeInTheDocument();
      expect(screen.queryByTestId('change-status')).not.toBeInTheDocument();
      expect(screen.queryByTestId('book-appointment')).not.toBeInTheDocument();
      expect(screen.queryByTestId('add-task')).not.toBeInTheDocument();
      expect(screen.getByTestId('add-companion')).toBeInTheDocument();
    });

    it('drops each action modal its permission denies', () => {
      renderModals({
        canEditCompanions: false,
        canEditAppointments: false,
        canEditTasks: false,
      });

      expect(screen.queryByTestId('change-status')).not.toBeInTheDocument();
      expect(screen.queryByTestId('book-appointment')).not.toBeInTheDocument();
      expect(screen.queryByTestId('add-task')).not.toBeInTheDocument();
      expect(screen.getByTestId('companion-info-detail')).toHaveTextContent('history|false');
    });
  });
});
