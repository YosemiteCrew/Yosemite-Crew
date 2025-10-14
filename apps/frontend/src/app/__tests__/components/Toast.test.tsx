import React from 'react';
// FIX 1: Import fireEvent
import { render, screen, act, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ErrorTost, useErrorTost } from '../../components/Toast';

jest.mock('@iconify/react/dist/iconify.js', () => ({
  Icon: (props: { icon: string }) => <div data-testid="mock-icon" data-icon={props.icon} />,
}));

describe('ErrorTost Component', () => {
  it('should render props correctly and call onClose when clicked', () => {
    const onCloseMock = jest.fn();

    render(
      <ErrorTost
        message="A detailed error message."
        errortext="Error Occurred"
        iconElement={<span data-testid="custom-icon">⚠️</span>}
        onClose={onCloseMock}
      />
    );

    expect(screen.getByRole('heading', { name: 'Error Occurred' })).toBeInTheDocument();
    expect(screen.getByText('A detailed error message.')).toBeInTheDocument();

    const closeButton = screen.getByTestId('mock-icon').closest('button');
    fireEvent.click(closeButton!);
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });
});

describe('useErrorTost Hook', () => {
  jest.useFakeTimers();

  const HookTester = () => {
    const { showErrorTost, ErrorTostPopup } = useErrorTost();
    return (
      <div>
        <button
          onClick={() => showErrorTost({
            message: 'Success!',
            errortext: 'Operation Complete',
            iconElement: <span data-testid="custom-icon">✅</span>,
          })}
        >
          Show Toast
        </button>
        {ErrorTostPopup}
      </div>
    );
  };

  it('should initially render nothing', () => {
    render(<HookTester />);
    expect(screen.queryByRole('heading', { name: 'Operation Complete' })).not.toBeInTheDocument();
  });

  it('should render the popup when showErrorTost is called', () => {
    render(<HookTester />);

    fireEvent.click(screen.getByRole('button', { name: 'Show Toast' }));

    expect(screen.getByRole('heading', { name: 'Operation Complete' })).toBeInTheDocument();
    expect(screen.getByText('Success!')).toBeInTheDocument();
  });

  it('should automatically hide the popup after the default duration', () => {
    render(<HookTester />);
    fireEvent.click(screen.getByRole('button', { name: 'Show Toast' }));
    expect(screen.getByText('Success!')).toBeInTheDocument();

    act(() => {
      jest.runAllTimers();
    });

    expect(screen.queryByText('Success!')).not.toBeInTheDocument();
  });

  it('should hide the popup immediately when its close button is clicked', () => {
    render(<HookTester />);

    fireEvent.click(screen.getByRole('button', { name: 'Show Toast' }));
    expect(screen.getByText('Success!')).toBeInTheDocument();

    const closeButton = screen.getByTestId('mock-icon').closest('button');
    fireEvent.click(closeButton!);

    expect(screen.queryByText('Success!')).not.toBeInTheDocument();
  });
});