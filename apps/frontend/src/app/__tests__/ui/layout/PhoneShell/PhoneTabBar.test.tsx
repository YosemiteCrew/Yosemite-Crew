import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { IconType } from 'react-icons';
import PhoneTabBar, { type PhoneTabItem } from '@/app/ui/layout/PhoneShell/PhoneTabBar';

const StubIcon: IconType = () => <svg data-testid="tab-icon" />;

const makeItems = (
  overrides: Partial<Record<string, Partial<PhoneTabItem>>> = {}
): PhoneTabItem[] => {
  const base: PhoneTabItem[] = [
    {
      key: 'home',
      label: 'Home',
      icon: StubIcon,
      href: '/dashboard',
      active: true,
      disabled: false,
    },
    {
      key: 'schedule',
      label: 'Schedule',
      icon: StubIcon,
      href: '/appointments',
      active: false,
      disabled: false,
    },
    {
      key: 'patients',
      label: 'Patients',
      icon: StubIcon,
      href: '/companions',
      active: false,
      disabled: true,
    },
    {
      key: 'chat',
      label: 'Chat',
      icon: StubIcon,
      href: '/chat',
      active: false,
      disabled: false,
      badgeCount: 3,
    },
    { key: 'more', label: 'More', icon: StubIcon, active: false, disabled: false, isMore: true },
  ];
  return base.map((item) => ({ ...item, ...overrides[item.key] }));
};

const setup = (props: Partial<React.ComponentProps<typeof PhoneTabBar>> = {}) => {
  const onNavigate = jest.fn();
  const onOpenMore = jest.fn();
  const utils = render(
    <PhoneTabBar
      items={makeItems()}
      moreOpen={false}
      onNavigate={onNavigate}
      onOpenMore={onOpenMore}
      {...props}
    />
  );
  return { ...utils, onNavigate, onOpenMore };
};

describe('PhoneTabBar', () => {
  it('renders a labelled nav with all five tabs', () => {
    setup();
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(nav).toBeInTheDocument();
    ['Home', 'Schedule', 'Patients', 'Chat', 'More'].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it('marks the active route tab with aria-current', () => {
    setup();
    expect(screen.getByRole('button', { name: /Home/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: /Schedule/ })).not.toHaveAttribute('aria-current');
  });

  it('navigates when an enabled route tab is clicked', () => {
    const { onNavigate } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Schedule/ }));
    expect(onNavigate).toHaveBeenCalledWith('/appointments');
  });

  it('does not navigate when a disabled tab is clicked', () => {
    const { onNavigate } = setup();
    const patients = screen.getByRole('button', { name: /Patients/ });
    expect(patients).toBeDisabled();
    fireEvent.click(patients);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('opens the More sheet and exposes dialog semantics', () => {
    const { onOpenMore } = setup({ moreOpen: false });
    const more = screen.getByRole('button', { name: /More/ });
    expect(more).toHaveAttribute('aria-haspopup', 'dialog');
    expect(more).toHaveAttribute('aria-expanded', 'false');
    expect(more).not.toHaveAttribute('aria-current');
    fireEvent.click(more);
    expect(onOpenMore).toHaveBeenCalledTimes(1);
  });

  it('reflects the open More sheet via aria-expanded', () => {
    setup({ moreOpen: true });
    expect(screen.getByRole('button', { name: /More/ })).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows the unread badge on Chat when the count is positive', () => {
    setup();
    const badge = screen.getByText('3');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('aria-label', '3 unread');
  });

  it('hides the unread badge when the count is zero', () => {
    render(
      <PhoneTabBar
        items={makeItems({ chat: { badgeCount: 0 } })}
        moreOpen={false}
        onNavigate={jest.fn()}
        onOpenMore={jest.fn()}
      />
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('caps the unread badge at 99+', () => {
    render(
      <PhoneTabBar
        items={makeItems({ chat: { badgeCount: 250 } })}
        moreOpen={false}
        onNavigate={jest.fn()}
        onOpenMore={jest.fn()}
      />
    );
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('never marks the More tab with aria-current even when it is active', () => {
    render(
      <PhoneTabBar
        items={makeItems({ more: { active: true } })}
        moreOpen={false}
        onNavigate={jest.fn()}
        onOpenMore={jest.fn()}
      />
    );
    const more = screen.getByRole('button', { name: /More/ });
    expect(more).toHaveClass('yc-phone-tab-active');
    expect(more).not.toHaveAttribute('aria-current');
  });

  it('does not navigate when a route tab has no href', () => {
    const onNavigate = jest.fn();
    render(
      <PhoneTabBar
        items={makeItems({ home: { href: undefined, active: false } })}
        moreOpen={false}
        onNavigate={onNavigate}
        onOpenMore={jest.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Home/ }));
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
