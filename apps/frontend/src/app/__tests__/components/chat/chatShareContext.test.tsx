import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatShareContext, useChatShare } from '@/app/features/chat/components/chatShareContext';

function Consumer() {
  const { openShare } = useChatShare();
  return (
    <button type="button" onClick={() => openShare('ch1')}>
      share
    </button>
  );
}

describe('useChatShare', () => {
  it('returns a no-op default when there is no provider', () => {
    render(<Consumer />);
    expect(() => fireEvent.click(screen.getByText('share'))).not.toThrow();
  });

  it('returns the provided openShare', () => {
    const openShare = jest.fn();
    render(
      <ChatShareContext.Provider value={{ openShare }}>
        <Consumer />
      </ChatShareContext.Provider>
    );
    fireEvent.click(screen.getByText('share'));
    expect(openShare).toHaveBeenCalledWith('ch1');
  });
});
