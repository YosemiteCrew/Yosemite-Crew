import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import TabToggle, { TabOption } from '@/app/ui/primitives/TabToggle/TabToggle';

const TABS: TabOption[] = [
  { key: 'services', label: 'All Services' },
  { key: 'packages', label: 'All Packages' },
  { key: 'archive', label: 'Archive' },
];

describe('TabToggle', () => {
  it('renders all tabs', () => {
    render(<TabToggle tabs={TABS} activeKey="services" onChange={jest.fn()} />);
    expect(screen.getByText('All Services')).toBeInTheDocument();
    expect(screen.getByText('All Packages')).toBeInTheDocument();
    expect(screen.getByText('Archive')).toBeInTheDocument();
  });

  it('marks active tab with aria-selected=true', () => {
    render(<TabToggle tabs={TABS} activeKey="packages" onChange={jest.fn()} />);
    const packagesTab = screen.getByRole('tab', { name: 'All Packages' });
    expect(packagesTab).toHaveAttribute('aria-selected', 'true');
    const servicesTab = screen.getByRole('tab', { name: 'All Services' });
    expect(servicesTab).toHaveAttribute('aria-selected', 'false');
  });

  it('calls onChange when a tab is clicked', () => {
    const onChange = jest.fn();
    render(<TabToggle tabs={TABS} activeKey="services" onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: 'All Packages' }));
    expect(onChange).toHaveBeenCalledWith('packages');
  });

  it('renders tab icons when provided', () => {
    const tabsWithIcon: TabOption[] = [
      {
        key: 'archive',
        label: 'Archive',
        icon: <span data-testid="archive-icon" aria-hidden="true" />,
      },
    ];
    render(<TabToggle tabs={tabsWithIcon} activeKey="archive" onChange={jest.fn()} />);
    expect(screen.getByTestId('archive-icon')).toBeInTheDocument();
  });

  it('has role=tablist on the container', () => {
    const { container } = render(
      <TabToggle tabs={TABS} activeKey="services" onChange={jest.fn()} />
    );
    expect(container.firstChild).toHaveAttribute('role', 'tablist');
  });

  it('wires aria-controls from the panelId resolver when provided', () => {
    render(
      <TabToggle
        tabs={TABS}
        activeKey="services"
        onChange={jest.fn()}
        panelId={(key) => `panel-${key}`}
      />
    );
    expect(screen.getByRole('tab', { name: 'All Services' })).toHaveAttribute(
      'aria-controls',
      'panel-services'
    );
  });

  it('styles the active tab with the blue design tokens, not the inactive tab', () => {
    render(<TabToggle tabs={TABS} activeKey="services" onChange={jest.fn()} />);
    const active = screen.getByRole('tab', { name: 'All Services' });
    expect(active.className).toContain('border-[var(--blue)]');
    expect(active.className).toContain('text-[var(--blue-text)]');
    const inactive = screen.getByRole('tab', { name: 'Archive' });
    expect(inactive.className).not.toContain('var(--blue)');
  });
});
