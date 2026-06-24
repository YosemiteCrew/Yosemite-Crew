import React, { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SearchResultsDropdown from '@/app/features/appointments/pages/AppointmentWorkspace/components/SearchResultsDropdown';

describe('SearchResultsDropdown', () => {
  const getAnchorRect = () =>
    ({
      bottom: 120,
      left: 64,
      width: 360,
    }) as DOMRect;

  const renderDropdown = (onClose = jest.fn()) => {
    const anchorRef = createRef<HTMLDivElement>();
    jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(getAnchorRect());
    render(
      <div>
        <div ref={anchorRef} data-testid="anchor" />
        <SearchResultsDropdown anchorRef={anchorRef} open onClose={onClose}>
          <div data-testid="panel-content">Results</div>
        </SearchResultsDropdown>
      </div>
    );

    return { onClose };
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders in a portal under the anchor', () => {
    renderDropdown();

    expect(screen.getByTestId('panel-content')).toBeInTheDocument();
    expect(screen.getByText('Results').parentElement).toHaveStyle({
      left: '64px',
      top: '124px',
      width: '360px',
    });
  });

  it('stays open when the panel itself scrolls', () => {
    const onClose = jest.fn();
    renderDropdown(onClose);

    fireEvent.scroll(screen.getByText('Results').parentElement as Element);

    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes when the page scrolls outside the dropdown', () => {
    const onClose = jest.fn();
    renderDropdown(onClose);

    fireEvent.scroll(globalThis.window);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
