import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AddCompanion from '@/app/features/companions/components/AddCompanion';

const companionSectionSpy = jest.fn();
let mockParentValidate: () => boolean | undefined = () => true;

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

jest.mock('@/app/features/companions/components/AddCompanion/Sections/Parent', () => {
  const ReactActual = jest.requireActual('react');
  return {
    __esModule: true,
    default: ReactActual.forwardRef((_props: any, ref: any) => {
      ReactActual.useImperativeHandle(ref, () => ({ validateStep: () => mockParentValidate() }));
      return ReactActual.createElement('div', null, 'parent-section');
    }),
  };
});

jest.mock('@/app/features/companions/components/AddCompanion/Sections/Companion', () => ({
  __esModule: true,
  default: (props: any) => {
    companionSectionSpy(props);
    return (
      <div>
        companion-section
        <button type="button" onClick={() => props.onCompanionCreated?.({ id: 'c1' })}>
          emit-created
        </button>
      </div>
    );
  },
}));

jest.mock('@/app/hooks/useCompanionTerminologyText', () => ({
  useCompanionTerminologyText: () => (text: string) => text,
}));

describe('AddCompanion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParentValidate = () => true;
  });

  it('renders modal and switches sections', () => {
    render(<AddCompanion showModal setShowModal={jest.fn()} />);

    expect(screen.getByTestId('modal')).toBeInTheDocument();
    expect(screen.getByText('parent-section')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Companion information' }));
    expect(screen.getByText('companion-section')).toBeInTheDocument();
  });

  it('closes modal when close icon is clicked', () => {
    const setShowModal = jest.fn();
    render(<AddCompanion showModal setShowModal={setShowModal} />);

    fireEvent.click(screen.getByText('close'));
    expect(setShowModal).toHaveBeenCalledWith(false);
  });

  it('passes fasttrack mode to companion section', () => {
    render(<AddCompanion showModal setShowModal={jest.fn()} mode="fasttrack" />);
    fireEvent.click(screen.getByRole('button', { name: 'Companion information' }));
    expect(companionSectionSpy).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'fasttrack' })
    );
  });

  it('blocks the companion step while the parent step is invalid', () => {
    mockParentValidate = () => false;
    render(<AddCompanion showModal setShowModal={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Companion information' }));

    // Navigation is blocked → still on the parent step, companion section not shown.
    expect(screen.getByText('parent-section')).toBeInTheDocument();
    expect(screen.queryByText('companion-section')).not.toBeInTheDocument();
  });

  it('forwards the created companion id from the companion step', () => {
    const onCompanionCreated = jest.fn();
    render(
      <AddCompanion showModal setShowModal={jest.fn()} onCompanionCreated={onCompanionCreated} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Companion information' }));
    fireEvent.click(screen.getByText('emit-created'));

    expect(onCompanionCreated).toHaveBeenCalledWith('c1');
  });
});
