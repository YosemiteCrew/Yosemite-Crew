import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import ErrorToast from '@/app/ui/widgets/Toast/ErrorToast';

jest.mock('@/app/ui/primitives/Icons/Close', () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      Close
    </button>
  ),
}));

jest.mock(
  'react-icons/io5',
  () =>
    new Proxy(
      { __esModule: true },
      {
        get: (_t, name) => {
          if (name === '__esModule') return true;
          const Icon =
            (_t as any)[String(name)] ||
            ((_t as any)[String(name)] = (props: any) => (
              <span data-testid={String(name)} onClick={props.onClick} />
            ));
          return Icon;
        },
      }
    )
);

describe('ErrorToast', () => {
  it('renders title and text and invokes closeToast', () => {
    const closeToast = jest.fn();

    render(
      <ErrorToast
        data={{ title: 'Error title', text: 'Something broke' }}
        closeToast={closeToast}
        isPaused={false}
        toastProps={{} as any}
      />
    );

    expect(screen.getByText('Error title')).toBeInTheDocument();
    expect(screen.getByText('Something broke')).toBeInTheDocument();
    expect(screen.getByTestId('IoAlertCircle')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Close'));
    expect(closeToast).toHaveBeenCalledTimes(1);
  });
});
