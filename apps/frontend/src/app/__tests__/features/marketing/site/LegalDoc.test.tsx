import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { DocSection, LegalDoc } from '@/app/features/marketing/site';

const TOC = [
  { id: 'first', label: '1. First section' },
  { id: 'second', label: '2. Second section' },
];

const renderDoc = () =>
  render(
    <LegalDoc
      eyebrow="Legal"
      title="Terms and conditions"
      subtitle="A subtitle."
      meta="Updated March 2026"
      toc={TOC}
    >
      <DocSection id="first" title="1. First section">
        <p>First body.</p>
      </DocSection>
      <DocSection id="second" title="2. Second section">
        <p>Second body.</p>
      </DocSection>
    </LegalDoc>
  );

describe('LegalDoc', () => {
  it('renders the hero, the contents and the anchored sections', () => {
    renderDoc();

    expect(screen.getByRole('heading', { name: 'Terms and conditions', level: 1 })).toBeVisible();
    expect(screen.getByText('A subtitle.')).toBeVisible();
    expect(screen.getByText('Updated March 2026')).toBeVisible();

    const nav = screen.getByRole('navigation');
    expect(within(nav).getByRole('link', { name: '1. First section' })).toHaveAttribute(
      'href',
      '#first'
    );
    expect(within(nav).getByRole('link', { name: '2. Second section' })).toHaveAttribute(
      'href',
      '#second'
    );
    expect(screen.getByRole('heading', { name: '1. First section', level: 2 })).toBeInTheDocument();
  });

  it('omits the meta line when the document has no last-updated note', () => {
    render(
      <LegalDoc eyebrow="Legal" title="Impressum" subtitle="A subtitle." toc={TOC}>
        <DocSection id="first" title="1. First section">
          <p>First body.</p>
        </DocSection>
      </LegalDoc>
    );

    expect(screen.getByRole('heading', { name: 'Impressum', level: 1 })).toBeVisible();
    expect(screen.queryByText('Updated March 2026')).not.toBeInTheDocument();
  });

  // The rail is hidden below the grid breakpoint, so the toggle is how a phone
  // reaches the contents of documents that run to tens of thousands of words.
  it('collapses the contents behind a toggle that reports its state', async () => {
    const user = userEvent.setup();
    renderDoc();

    const toggle = screen.getByRole('button', { name: /on this page/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-controls', 'yc-toc-list');
    expect(screen.getByRole('navigation')).toHaveAttribute('data-open', 'false');

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('navigation')).toHaveAttribute('data-open', 'true');
  });

  it('closes the contents again once a section is chosen', async () => {
    const user = userEvent.setup();
    renderDoc();

    const toggle = screen.getByRole('button', { name: /on this page/i });
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await user.click(screen.getByRole('link', { name: '2. Second section' }));

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('navigation')).toHaveAttribute('data-open', 'false');
  });
});
