import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';

let isPhoneValue = false;
jest.mock('@/app/ui/layout/PhoneShell/useIsPhone', () => ({
  __esModule: true,
  useIsPhone: () => isPhoneValue,
  default: () => isPhoneValue,
}));

import GuideFilters from '@/app/features/guides/components/GuideFilters';

/**
 * Two controls at two widths, so every test says which width it is at.
 *
 * The phone half exists because the chip rows wrapped to nine rows at 375px -
 * seven personas over three and thirteen categories over six - which is about
 * half the screen of filters before the first video card. Measured in a browser
 * 2026-09-05, and the phone assertions below are what keep it from coming back.
 */
const PERSONAS = ['All roles', 'Everyone', 'Front desk', 'Veterinarian'];
const CATEGORIES = ['All', 'Getting started', 'Money', 'The visit'];

const setActivePersona = jest.fn();
const setActiveCategory = jest.fn();
const setSearch = jest.fn();

const renderFilters = (overrides: Partial<React.ComponentProps<typeof GuideFilters>> = {}) =>
  render(
    <GuideFilters
      personas={PERSONAS}
      activePersona="All roles"
      setActivePersona={setActivePersona}
      categories={CATEGORIES}
      activeCategory="All"
      setActiveCategory={setActiveCategory}
      search=""
      setSearch={setSearch}
      {...overrides}
    />
  );

beforeEach(() => {
  jest.clearAllMocks();
  isPhoneValue = false;
});

describe('GuideFilters on desktop', () => {
  it('lays every option out as a chip', () => {
    renderFilters();

    for (const label of [...PERSONAS, ...CATEGORIES]) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    // No sheet triggers: those are the phone control.
    expect(screen.queryByRole('menuitemradio')).not.toBeInTheDocument();
  });

  it('reports the chip that was clicked', () => {
    renderFilters();

    fireEvent.click(screen.getByRole('button', { name: 'Veterinarian' }));
    expect(setActivePersona).toHaveBeenCalledWith('Veterinarian');

    fireEvent.click(screen.getByRole('button', { name: 'Money' }));
    expect(setActiveCategory).toHaveBeenCalledWith('Money');
  });

  it('drops the persona row when there is only one track', () => {
    // A single persona is not a choice, so the row would be a label with one
    // button under it.
    renderFilters({ personas: ['All roles'], activePersona: 'All roles' });

    expect(screen.queryByText('For')).not.toBeInTheDocument();
  });
});

describe('GuideFilters on a phone', () => {
  beforeEach(() => {
    isPhoneValue = true;
  });

  it('collapses both groups onto one row of triggers', () => {
    renderFilters();

    // The whole point: the options are behind two controls, not laid out as
    // rows of chips that push the first video off the screen.
    expect(screen.getByRole('button', { name: /^For/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Topic/ })).toBeInTheDocument();
    for (const label of ['Everyone', 'Front desk', 'Getting started', 'Money']) {
      expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument();
    }
  });

  it('names the current choice on the trigger', () => {
    renderFilters({ activePersona: 'Front desk', activeCategory: 'Money' });

    expect(screen.getByRole('button', { name: /^For/ })).toHaveTextContent('Front desk');
    expect(screen.getByRole('button', { name: /^Topic/ })).toHaveTextContent('Money');
  });

  it('opens the topics as a list and marks the active one', () => {
    renderFilters();

    fireEvent.click(screen.getByRole('button', { name: /^Topic/ }));

    const options = screen.getAllByRole('menuitemradio');
    expect(options.map((option) => option.textContent?.trim())).toEqual(CATEGORIES);
    expect(screen.getByRole('menuitemradio', { name: /All/ })).toHaveAttribute(
      'aria-checked',
      'true'
    );
  });

  it('opens the personas under their own heading', () => {
    renderFilters();

    fireEvent.click(screen.getByRole('button', { name: /^For/ }));

    expect(screen.getByText('Show guides for')).toBeInTheDocument();
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(PERSONAS.length);
  });

  it('reports the choice and closes the sheet', () => {
    renderFilters();

    fireEvent.click(screen.getByRole('button', { name: /^Topic/ }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Money/ }));

    expect(setActiveCategory).toHaveBeenCalledWith('Money');
    // Closing on pick is what makes this one tap per filter rather than two.
    expect(screen.queryByRole('menuitemradio')).not.toBeInTheDocument();
  });

  it('offers no persona trigger when there is only one track', () => {
    renderFilters({ personas: ['All roles'], activePersona: 'All roles' });

    expect(screen.queryByRole('button', { name: /^For/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Topic/ })).toBeInTheDocument();
  });

  it('closes without changing anything when dismissed', () => {
    renderFilters();

    fireEvent.click(screen.getByRole('button', { name: /^Topic/ }));
    /* Two buttons in the sheet answer to "Close": the chrome's and the
       backdrop, which BottomSheet also labels that way. Take the chrome one. */
    const [chromeClose] = within(screen.getByRole('dialog')).getAllByRole('button', {
      name: 'Close',
    });
    fireEvent.click(chromeClose);

    expect(screen.queryByRole('menuitemradio')).not.toBeInTheDocument();
    // Backing out is not a choice: the grid must not re-filter behind the sheet.
    expect(setActiveCategory).not.toHaveBeenCalled();
  });

  it('keeps the search box', () => {
    renderFilters();

    fireEvent.change(screen.getByPlaceholderText('Search guides'), {
      target: { value: 'stripe' },
    });
    expect(setSearch).toHaveBeenCalled();
  });
});
