import React, { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { usePhonePrimaryAction } from '@/app/ui/layout/PhoneShell/usePhonePrimaryAction';
import {
  PHONE_PRIMARY_ACTION_EVENT,
  type FabActionKey,
  type PhonePrimaryActionDetail,
} from '@/app/ui/layout/PhoneShell/phoneShellConfig';

const dispatch = (key: FabActionKey, href = '/appointments') => {
  act(() => {
    globalThis.window.dispatchEvent(
      new CustomEvent<PhonePrimaryActionDetail>(PHONE_PRIMARY_ACTION_EVENT, {
        detail: { key, href },
      })
    );
  });
};

/** Stands in for a real page: the hook must open its create modal for real. */
const CreatePage = ({ actionKey = 'appointment' as FabActionKey }) => {
  const [open, setOpen] = useState(false);
  usePhonePrimaryAction(actionKey, () => setOpen(true));
  return open ? <div role="dialog">Create modal</div> : <p>No modal</p>;
};

describe('usePhonePrimaryAction', () => {
  it('opens the page create flow when the FAB fires its key', () => {
    render(<CreatePage />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    dispatch('appointment');

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('ignores an event for a different action key', () => {
    render(<CreatePage actionKey="product" />);

    dispatch('appointment');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('ignores an event with no detail', () => {
    render(<CreatePage />);

    act(() => {
      globalThis.window.dispatchEvent(new CustomEvent(PHONE_PRIMARY_ACTION_EVENT));
    });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calls the latest handler without resubscribing when it is re-created each render', () => {
    const calls: string[] = [];
    const Rerendering = () => {
      const [count, setCount] = useState(0);
      usePhonePrimaryAction('task', () => calls.push(`count:${count}`));
      return (
        <button type="button" onClick={() => setCount((c) => c + 1)}>
          bump {count}
        </button>
      );
    };
    render(<Rerendering />);

    fireEvent.click(screen.getByRole('button', { name: /bump/ }));
    dispatch('task', '/tasks');

    expect(calls).toEqual(['count:1']);
  });

  it('stops listening once the page unmounts', () => {
    const handler = jest.fn();
    const Page = () => {
      usePhonePrimaryAction('companion', handler);
      return null;
    };
    const { unmount } = render(<Page />);
    unmount();

    dispatch('companion', '/companions');

    expect(handler).not.toHaveBeenCalled();
  });
});
