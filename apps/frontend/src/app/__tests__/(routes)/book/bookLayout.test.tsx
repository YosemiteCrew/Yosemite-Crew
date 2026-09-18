import React from 'react';
import { within } from '@testing-library/react';

import { renderServerComponent } from '@/app/__tests__/support/renderServerComponent';
import BookLayout from '@/app/(routes)/(book)/layout';

describe('the (book) layout', () => {
  it('puts the public booking pages inside the app token scope', () => {
    // Without this marker the route sits outside body:has([data-yc-app]) and
    // [data-yc-app], so it gets neither the readable bone-surface inks nor a
    // color-scheme for the native date picker and checkbox.
    const { container } = renderServerComponent(
      <BookLayout>
        <p>booking</p>
      </BookLayout>
    );

    expect(within(container).getByText('booking')).not.toBeNull();
    expect(container.querySelector('[data-yc-app]')).not.toBeNull();
  });

  it('resolves the theme before paint, which this route never did', () => {
    // The (book) group had no layout at all, so nothing stamped data-theme on
    // <html> and the entire dark palette was dead code here.
    const { container } = renderServerComponent(
      <BookLayout>
        <p>booking</p>
      </BookLayout>
    );

    expect(container.querySelector('script')).not.toBeNull();
  });
});
