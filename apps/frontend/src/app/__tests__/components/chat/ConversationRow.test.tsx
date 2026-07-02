import { render, screen, fireEvent } from '@testing-library/react';
import { ConversationRow } from '@/app/features/chat/components/ConversationRow';

describe('ConversationRow', () => {
  const base = {
    name: 'Bella Rose',
    preview: 'See you tomorrow',
  };

  it('renders the name, preview, time and unread badge', () => {
    render(<ConversationRow {...base} time="9:41 AM" unread={3} />);
    expect(screen.getByText('Bella Rose')).toBeInTheDocument();
    expect(screen.getByText('See you tomorrow')).toBeInTheDocument();
    expect(screen.getByText('9:41 AM')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('does not render time or unread badge when not provided', () => {
    render(<ConversationRow {...base} />);
    expect(screen.queryByText('9:41 AM')).not.toBeInTheDocument();
    // No badge number present.
    expect(screen.queryByText('3')).not.toBeInTheDocument();
  });

  it('renders the network glyph when network is true', () => {
    render(<ConversationRow {...base} network />);
    expect(screen.getByLabelText('Across the network')).toBeInTheDocument();
  });

  it('does not render the network glyph by default', () => {
    render(<ConversationRow {...base} />);
    expect(screen.queryByLabelText('Across the network')).not.toBeInTheDocument();
  });

  it('renders the via-app glyph when viaApp is true', () => {
    render(<ConversationRow {...base} viaApp />);
    expect(screen.getByLabelText('Messages via pet parent app')).toBeInTheDocument();
  });

  it('does not render the via-app glyph by default', () => {
    render(<ConversationRow {...base} />);
    expect(screen.queryByLabelText('Messages via pet parent app')).not.toBeInTheDocument();
  });

  it('renders the muted icon when muted is true', () => {
    render(<ConversationRow {...base} muted onUnmute={jest.fn()} />);
    expect(screen.getByLabelText('Muted')).toBeInTheDocument();
  });

  it('applies the active styling and aria-current when active', () => {
    render(<ConversationRow {...base} active />);
    const rowButton = screen.getByRole('button', { name: /Bella Rose/ });
    expect(rowButton).toHaveAttribute('aria-current', 'true');
  });

  it('calls onClick when the row button is clicked', () => {
    const onClick = jest.fn();
    render(<ConversationRow {...base} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: /Bella Rose/ }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not render the kebab when no action props are supplied (hasActions false)', () => {
    render(<ConversationRow {...base} />);
    expect(screen.queryByLabelText('Conversation actions')).not.toBeInTheDocument();
  });

  describe('triage kebab menu (unmuted)', () => {
    const handlers = () => ({
      onMute: jest.fn(),
      onSnooze: jest.fn(),
      onArchive: jest.fn(),
    });

    it('renders the kebab and toggles the menu open', () => {
      render(<ConversationRow {...base} {...handlers()} />);
      const kebab = screen.getByLabelText('Conversation actions');
      // Menu items not present until opened.
      expect(screen.queryByText('Mute')).not.toBeInTheDocument();
      fireEvent.click(kebab);
      expect(screen.getByText('Mute')).toBeInTheDocument();
      expect(screen.getByText('Snooze 1 hour')).toBeInTheDocument();
      expect(screen.getByText('Snooze 1 day')).toBeInTheDocument();
      expect(screen.getByText('Archive')).toBeInTheDocument();
    });

    it('clicking Mute calls onMute and closes the menu', () => {
      const h = handlers();
      render(<ConversationRow {...base} {...h} />);
      fireEvent.click(screen.getByLabelText('Conversation actions'));
      fireEvent.click(screen.getByText('Mute'));
      expect(h.onMute).toHaveBeenCalledTimes(1);
      // Menu closed.
      expect(screen.queryByText('Mute')).not.toBeInTheDocument();
    });

    it('clicking Snooze 1 hour calls onSnooze with one hour in ms', () => {
      const h = handlers();
      render(<ConversationRow {...base} {...h} />);
      fireEvent.click(screen.getByLabelText('Conversation actions'));
      fireEvent.click(screen.getByText('Snooze 1 hour'));
      expect(h.onSnooze).toHaveBeenCalledWith(60 * 60 * 1000);
    });

    it('clicking Snooze 1 day calls onSnooze with one day in ms', () => {
      const h = handlers();
      render(<ConversationRow {...base} {...h} />);
      fireEvent.click(screen.getByLabelText('Conversation actions'));
      fireEvent.click(screen.getByText('Snooze 1 day'));
      expect(h.onSnooze).toHaveBeenCalledWith(24 * 60 * 60 * 1000);
    });

    it('clicking Archive calls onArchive', () => {
      const h = handlers();
      render(<ConversationRow {...base} {...h} />);
      fireEvent.click(screen.getByLabelText('Conversation actions'));
      fireEvent.click(screen.getByText('Archive'));
      expect(h.onArchive).toHaveBeenCalledTimes(1);
    });

    it('clicking Unarchive calls onUnarchive', () => {
      const onUnarchive = jest.fn();
      render(<ConversationRow {...base} onUnarchive={onUnarchive} />);
      fireEvent.click(screen.getByLabelText('Conversation actions'));
      fireEvent.click(screen.getByText('Unarchive'));
      expect(onUnarchive).toHaveBeenCalledTimes(1);
    });

    it('closing via the backdrop dismisses the menu', () => {
      render(<ConversationRow {...base} {...handlers()} />);
      fireEvent.click(screen.getByLabelText('Conversation actions'));
      fireEvent.click(screen.getByLabelText('Close menu'));
      expect(screen.queryByText('Mute')).not.toBeInTheDocument();
    });
  });

  describe('triage kebab menu (muted)', () => {
    it('shows Unmute (not Mute) and calls onUnmute', () => {
      const onUnmute = jest.fn();
      render(<ConversationRow {...base} muted onUnmute={onUnmute} />);
      fireEvent.click(screen.getByLabelText('Conversation actions'));
      expect(screen.getByText('Unmute')).toBeInTheDocument();
      expect(screen.queryByText('Mute')).not.toBeInTheDocument();
      fireEvent.click(screen.getByText('Unmute'));
      expect(onUnmute).toHaveBeenCalledTimes(1);
    });
  });
});
