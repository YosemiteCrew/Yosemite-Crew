import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { IconType } from 'react-icons';
import PhoneMoreSheet, {
  type PhoneMoreLink,
  type PhoneMoreSection,
} from '@/app/ui/layout/PhoneShell/PhoneMoreSheet';

const StubIcon: IconType = () => <svg data-testid="more-icon" />;

const sections: PhoneMoreSection[] = [
  {
    key: 'tasks',
    label: 'Tasks',
    context: 'Team to-dos and follow-ups',
    href: '/tasks',
    icon: StubIcon,
    disabled: false,
  },
  {
    key: 'finance',
    label: 'Finance',
    context: 'Invoices and payments',
    href: '/finance',
    icon: StubIcon,
    disabled: true,
  },
];

const links: PhoneMoreLink[] = [
  { key: 'settings', label: 'Settings', href: '/settings', icon: StubIcon },
  { key: 'developer-portal', label: 'Developer portal', href: '/developers/home', icon: StubIcon },
];

const setup = (props: Partial<React.ComponentProps<typeof PhoneMoreSheet>> = {}) => {
  const onClose = jest.fn();
  const onNavigate = jest.fn();
  const utils = render(
    <PhoneMoreSheet
      open
      onClose={onClose}
      sections={sections}
      links={links}
      onNavigate={onNavigate}
      {...props}
    />
  );
  return { ...utils, onClose, onNavigate };
};

describe('PhoneMoreSheet', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <PhoneMoreSheet
        open={false}
        onClose={jest.fn()}
        sections={sections}
        links={links}
        onNavigate={jest.fn()}
      />
    );
    expect(container.querySelector('.yc-phone-sheet')).not.toBeInTheDocument();
  });

  it('renders the six-area sheet with context lines, links and status', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'More' })).toBeInTheDocument();
    expect(screen.getByText('Tasks')).toBeInTheDocument();
    expect(screen.getByText('Team to-dos and follow-ups')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Developer portal')).toBeInTheDocument();
    expect(screen.getByText('All systems live')).toBeInTheDocument();
  });

  it('navigates and closes when an enabled area is tapped', () => {
    const { onNavigate, onClose } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Tasks/ }));
    expect(onNavigate).toHaveBeenCalledWith('/tasks');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('disables a gated area and does not navigate', () => {
    const { onNavigate } = setup();
    const finance = screen.getByRole('button', { name: /Finance/ });
    expect(finance).toBeDisabled();
    fireEvent.click(finance);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('navigates and closes when a footer link is tapped', () => {
    const { onNavigate, onClose } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Developer portal' }));
    expect(onNavigate).toHaveBeenCalledWith('/developers/home');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
