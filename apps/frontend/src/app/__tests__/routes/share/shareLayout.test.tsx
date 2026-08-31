import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import ShareLayout from '@/app/(routes)/(share)/layout';

describe('the (share) layout', () => {
  it('puts the shared passport and card pages inside the app token scope', () => {
    // Without this marker the routes sit outside body:has([data-yc-app]), so
    // --ink-faint stays at the marketing value - 3.12:1 on the passport card,
    // at font sizes down to 10.5px.
    const { container } = render(
      <ShareLayout>
        <p>shared record</p>
      </ShareLayout>
    );

    expect(screen.getByText('shared record')).toBeInTheDocument();
    expect(container.querySelector('[data-yc-app]')).not.toBeNull();
  });

  it('resolves the theme before paint, which this group never did', () => {
    // (share) was the last route group with no theme resolution at all, so the
    // whole html[data-theme='dark'] block was dead code on these two pages.
    const { container } = render(
      <ShareLayout>
        <p>shared record</p>
      </ShareLayout>
    );

    expect(container.querySelector('script')).not.toBeNull();
  });
});
