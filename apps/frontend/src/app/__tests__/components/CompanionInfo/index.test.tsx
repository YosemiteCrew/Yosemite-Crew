/* eslint-disable @next/next/no-img-element */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CompanionInfo } from '@/app/features/companions/components';

jest.mock('@/app/ui/overlays/Modal', () => ({
  __esModule: true,
  default: ({ showModal, children }: any) =>
    showModal ? <div data-testid="modal">{children}</div> : null,
}));

jest.mock('@/app/ui/primitives/Icons/Close', () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      close
    </button>
  ),
}));

jest.mock('@/app/ui/widgets/Labels/Labels', () => ({
  __esModule: true,
  default: ({ labels, setActiveLabel }: any) => (
    <div>
      {labels.map((label: any) => (
        <button key={label.key} type="button" onClick={() => setActiveLabel(label.key)}>
          {label.name}
        </button>
      ))}
    </div>
  ),
}));

jest.mock('@/app/features/companions/components/Sections', () => ({
  Companion: () => <div>companion-section</div>,
  Parent: () => <div>parent-section</div>,
  Core: () => <div>core-section</div>,
  History: () => <div>history-section</div>,
  AddAppointment: () => <div>add-appointment</div>,
  AddTask: () => <div>add-task</div>,
}));

jest.mock('@/app/lib/urls', () => ({
  getSafeImageUrl: () => 'https://example.com/pet.png',
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img alt={props.alt} {...props} />,
}));

describe('CompanionInfo', () => {
  it('renders modal and switches sub-section', () => {
    const setShowModal = jest.fn();
    const companion: any = {
      companion: { name: 'Buddy', breed: 'Lab', type: 'dog', photoUrl: '' },
    };

    render(<CompanionInfo showModal setShowModal={setShowModal} activeCompanion={companion} />);

    expect(screen.getByTestId('modal')).toBeInTheDocument();
    expect(screen.getByText('Buddy')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Records' }));
    expect(screen.getByText('history-section')).toBeInTheDocument();
  });
});
