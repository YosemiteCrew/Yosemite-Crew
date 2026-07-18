import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SheetChrome from '@/app/ui/overlays/Sheet/SheetChrome';

describe('SheetChrome', () => {
  it('always renders the grabber and a body around the content', () => {
    const { container } = render(
      <SheetChrome>
        <span>Body content</span>
      </SheetChrome>
    );

    expect(container.querySelector('.yc-phone-sheet-grabber')).toBeInTheDocument();
    const body = container.querySelector('.yc-phone-sheet-body');
    expect(body).toHaveTextContent('Body content');
  });

  it('renders a labelled title row with a close button when a title is given', () => {
    const onClose = jest.fn();
    const { container } = render(
      <SheetChrome title="More" titleId="sheet-title" onClose={onClose}>
        <span>Body</span>
      </SheetChrome>
    );

    expect(container.querySelector('.yc-phone-sheet-head')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'More' })).toHaveAttribute('id', 'sheet-title');

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('omits the title row when no title is given, so a caller header never doubles up', () => {
    const { container } = render(
      <SheetChrome>
        <span>Body</span>
      </SheetChrome>
    );

    expect(container.querySelector('.yc-phone-sheet-head')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
  });

  it('renders a footer region only when a footer is provided', () => {
    const withFooter = render(
      <SheetChrome footer={<button type="button">Done</button>}>
        <span>Body</span>
      </SheetChrome>
    );
    expect(withFooter.container.querySelector('.yc-phone-sheet-footer')).toHaveTextContent('Done');
    withFooter.unmount();

    const { container } = render(
      <SheetChrome>
        <span>Body</span>
      </SheetChrome>
    );
    expect(container.querySelector('.yc-phone-sheet-footer')).not.toBeInTheDocument();
  });
});
