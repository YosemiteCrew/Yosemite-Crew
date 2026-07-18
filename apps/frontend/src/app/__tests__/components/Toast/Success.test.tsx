import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import Success from '@/app/ui/widgets/Toast/Success';

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

describe('Success', () => {
  it('renders title and text and invokes closeToast', () => {
    const closeToast = jest.fn();

    render(
      <Success
        data={{ title: 'Success title', text: 'All done' }}
        closeToast={closeToast}
        isPaused={false}
        toastProps={{} as any}
      />
    );

    expect(screen.getByText('Success title')).toBeInTheDocument();
    expect(screen.getByText('All done')).toBeInTheDocument();
    expect(screen.getByTestId('IoCheckmarkCircle')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Close'));
    expect(closeToast).toHaveBeenCalledTimes(1);
  });
});
