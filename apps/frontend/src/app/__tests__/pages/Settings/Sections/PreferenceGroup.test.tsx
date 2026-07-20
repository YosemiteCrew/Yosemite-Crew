import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import {
  PreferenceGroup,
  PreferenceRow,
} from '@/app/features/settings/pages/Settings/Sections/PreferenceGroup';

describe('PreferenceGroup', () => {
  it('renders the group title and its children', () => {
    render(
      <PreferenceGroup title="Workspace preferences">
        <div>child content</div>
      </PreferenceGroup>
    );

    expect(screen.getByRole('heading', { name: 'Workspace preferences' })).toBeInTheDocument();
    expect(screen.getByText('child content')).toBeInTheDocument();
  });

  it('appends an extra className when provided', () => {
    const { container } = render(
      <PreferenceGroup title="Group" className="custom-class">
        <span>x</span>
      </PreferenceGroup>
    );

    expect(container.querySelector('section')).toHaveClass('custom-class');
  });

  it('renders without an extra className', () => {
    const { container } = render(
      <PreferenceGroup title="Group">
        <span>x</span>
      </PreferenceGroup>
    );

    // The trailing space from the template literal is trimmed away.
    expect(container.querySelector('section')?.className.endsWith(' ')).toBe(false);
  });
});

describe('PreferenceRow', () => {
  it('renders the label, description and control (center aligned by default)', () => {
    const { container } = render(
      <PreferenceRow label="Appearance" description="Light, dark, or follow the system">
        <button type="button">control</button>
      </PreferenceRow>
    );

    expect(screen.getByText('Appearance')).toBeInTheDocument();
    expect(screen.getByText('Light, dark, or follow the system')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'control' })).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('items-center');
  });

  it('omits the description node when none is provided', () => {
    render(
      <PreferenceRow label="Only label">
        <span>ctrl</span>
      </PreferenceRow>
    );

    expect(screen.getByText('Only label')).toBeInTheDocument();
    expect(screen.getByText('ctrl')).toBeInTheDocument();
  });

  it('supports the start alignment variant', () => {
    const { container } = render(
      <PreferenceRow label="Row" align="start">
        <span>ctrl</span>
      </PreferenceRow>
    );

    expect(container.firstChild).toHaveClass('items-start');
  });
});
