import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import SearchDropdown from '@/app/ui/inputs/SearchDropdown';

jest.mock('react-icons/io', () => ({
  IoIosSearch: () => <span data-testid="icon-search" />,
  IoIosWarning: () => <span data-testid="icon-warning" />,
}));

expect.extend(toHaveNoViolations);

const Wrapper = ({ onSelect }: { onSelect: (val: string) => void }) => {
  const [query, setQuery] = useState('');
  return (
    <SearchDropdown
      options={[
        { value: 'buddy', label: 'Buddy' },
        { value: 'bella', label: 'Bella' },
      ]}
      onSelect={onSelect}
      placeholder="Search companion"
      query={query}
      setQuery={setQuery}
      minChars={1}
    />
  );
};

const THREE_OPTIONS = [
  { value: 'buddy', label: 'Buddy' },
  { value: 'bella', label: 'Bella' },
  { value: 'bruno', label: 'Bruno' },
];

/** Stateful host so `query` round-trips through the parent like it does in the app. */
const ThreeOptionWrapper = ({
  onSelect = jest.fn(),
  minChars = 1,
}: {
  onSelect?: (val: string) => void;
  minChars?: number;
}) => {
  const [query, setQuery] = useState('');
  return (
    <SearchDropdown
      options={THREE_OPTIONS}
      onSelect={onSelect}
      placeholder="Search companion"
      query={query}
      setQuery={setQuery}
      minChars={minChars}
    />
  );
};

/** The listbox marks the active option with `aria-activedescendant` on the input. */
const activeDescendant = () =>
  screen.getByPlaceholderText('Search companion').getAttribute('aria-activedescendant');

describe('SearchDropdown', () => {
  it('shows filtered options when query meets min chars', () => {
    render(<Wrapper onSelect={jest.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('Search companion'), {
      target: { value: 'b' },
    });

    expect(screen.getByText('Buddy')).toBeInTheDocument();
    expect(screen.getByText('Bella')).toBeInTheDocument();
  });

  it('selects an option and closes the list', () => {
    const onSelect = jest.fn();
    render(<Wrapper onSelect={onSelect} />);

    fireEvent.change(screen.getByPlaceholderText('Search companion'), {
      target: { value: 'bud' },
    });
    fireEvent.click(screen.getByText('Buddy'));

    expect(onSelect).toHaveBeenCalledWith('buddy');
    expect(screen.queryByText('Buddy')).not.toBeInTheDocument();
  });

  it('selects a result with arrow keys and enter', () => {
    const onSelect = jest.fn();
    render(<Wrapper onSelect={onSelect} />);

    const input = screen.getByPlaceholderText('Search companion');
    fireEvent.change(input, { target: { value: 'b' } });
    fireEvent.keyDown(input, { key: 'End' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSelect).toHaveBeenCalledWith('bella');
  });

  it('renders error message when provided', () => {
    render(
      <SearchDropdown
        options={[]}
        onSelect={jest.fn()}
        placeholder="Search"
        query={''}
        setQuery={jest.fn()}
        error="Required"
      />
    );

    expect(screen.getByText('Required')).toBeInTheDocument();
    expect(screen.getByTestId('icon-warning')).toBeInTheDocument();
  });

  it('supports home, escape, and loading-more states', () => {
    const setQuery = jest.fn();
    const onSelect = jest.fn();
    const onReachEnd = jest.fn();

    render(
      <SearchDropdown
        options={[
          { value: 'buddy', label: 'Buddy' },
          { value: 'bella', label: 'Bella' },
        ]}
        onSelect={onSelect}
        placeholder="Search"
        query="b"
        setQuery={setQuery}
        minChars={1}
        onReachEnd={onReachEnd}
        hasMore={true}
        isLoadingMore={true}
      />
    );

    const input = screen.getByPlaceholderText('Search');
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'Home' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('buddy');

    fireEvent.focus(input);
    expect(screen.getByText('Loading more results…')).toBeInTheDocument();
    fireEvent.scroll(screen.getByRole('button', { name: 'Buddy' }).parentElement!);
    expect(onReachEnd).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByText('Buddy')).not.toBeInTheDocument();
  });

  it('requests more results when scrolling near the bottom', () => {
    const onReachEnd = jest.fn();

    render(
      <SearchDropdown
        options={[
          { value: 'buddy', label: 'Buddy' },
          { value: 'bella', label: 'Bella' },
        ]}
        onSelect={jest.fn()}
        placeholder="Search"
        query="b"
        setQuery={jest.fn()}
        minChars={1}
        onReachEnd={onReachEnd}
        hasMore={true}
      />
    );

    const input = screen.getByPlaceholderText('Search');
    fireEvent.focus(input);
    const panel = screen.getByRole('button', { name: 'Buddy' }).parentElement as HTMLDivElement;
    Object.defineProperty(panel, 'scrollHeight', { configurable: true, value: 200 });
    Object.defineProperty(panel, 'scrollTop', { configurable: true, value: 80, writable: true });
    Object.defineProperty(panel, 'clientHeight', { configurable: true, value: 100 });

    fireEvent.scroll(panel);

    expect(onReachEnd).toHaveBeenCalledTimes(1);
  });

  it('does not request more results when scrolling short of the bottom', () => {
    const onReachEnd = jest.fn();

    render(
      <SearchDropdown
        options={[
          { value: 'buddy', label: 'Buddy' },
          { value: 'bella', label: 'Bella' },
        ]}
        onSelect={jest.fn()}
        placeholder="Search"
        query="b"
        setQuery={jest.fn()}
        minChars={1}
        onReachEnd={onReachEnd}
        hasMore={true}
      />
    );

    fireEvent.focus(screen.getByPlaceholderText('Search'));
    const panel = screen.getByRole('button', { name: 'Buddy' }).parentElement as HTMLDivElement;
    Object.defineProperty(panel, 'scrollHeight', { configurable: true, value: 500 });
    Object.defineProperty(panel, 'scrollTop', { configurable: true, value: 0, writable: true });
    Object.defineProperty(panel, 'clientHeight', { configurable: true, value: 100 });

    fireEvent.scroll(panel);

    expect(onReachEnd).not.toHaveBeenCalled();
  });

  it('ignores scroll when there is nothing more to load', () => {
    const onReachEnd = jest.fn();

    const { rerender } = render(
      <SearchDropdown
        options={[{ value: 'buddy', label: 'Buddy' }]}
        onSelect={jest.fn()}
        placeholder="Search"
        query="b"
        setQuery={jest.fn()}
        minChars={1}
        onReachEnd={onReachEnd}
        hasMore={false}
      />
    );

    fireEvent.focus(screen.getByPlaceholderText('Search'));
    fireEvent.scroll(screen.getByRole('button', { name: 'Buddy' }).parentElement!);
    expect(onReachEnd).not.toHaveBeenCalled();

    // No onReachEnd handler at all: the scroll is a no-op too.
    rerender(
      <SearchDropdown
        options={[{ value: 'buddy', label: 'Buddy' }]}
        onSelect={jest.fn()}
        placeholder="Search"
        query="b"
        setQuery={jest.fn()}
        minChars={1}
        hasMore={true}
      />
    );
    fireEvent.scroll(screen.getByRole('button', { name: 'Buddy' }).parentElement!);
    expect(onReachEnd).not.toHaveBeenCalled();
  });

  it('hides the error after a selection has been made', () => {
    const onSelect = jest.fn();
    render(
      <SearchDropdown
        options={[{ value: 'buddy', label: 'Buddy' }]}
        onSelect={onSelect}
        placeholder="Search"
        query="b"
        setQuery={jest.fn()}
        minChars={1}
        error="Required"
      />
    );

    fireEvent.focus(screen.getByPlaceholderText('Search'));
    fireEvent.click(screen.getByText('Buddy'));

    expect(onSelect).toHaveBeenCalledWith('buddy');
    expect(screen.queryByText('Required')).not.toBeInTheDocument();
  });

  it('closes on an outside mousedown and stays open for one inside', () => {
    render(<ThreeOptionWrapper />);

    const input = screen.getByPlaceholderText('Search companion');
    fireEvent.change(input, { target: { value: 'b' } });
    expect(screen.getByRole('button', { name: 'Buddy' })).toBeInTheDocument();

    // Inside the dropdown root: `contains` is true, so the list stays open.
    fireEvent.mouseDown(input);
    expect(screen.getByRole('button', { name: 'Buddy' })).toBeInTheDocument();

    // Outside the dropdown root: `contains` is false, so the list closes.
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('button', { name: 'Buddy' })).not.toBeInTheDocument();
  });

  it('wraps the active option forwards and backwards with the arrow keys', () => {
    const onSelect = jest.fn();
    render(<ThreeOptionWrapper onSelect={onSelect} />);

    const input = screen.getByPlaceholderText('Search companion');
    fireEvent.change(input, { target: { value: 'b' } });
    expect(activeDescendant()).toContain('-option-buddy');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(activeDescendant()).toContain('-option-bella');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(activeDescendant()).toContain('-option-bruno');

    // Past the end: wraps back to the first option.
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(activeDescendant()).toContain('-option-buddy');

    // Before the start: wraps to the last option.
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(activeDescendant()).toContain('-option-bruno');

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(activeDescendant()).toContain('-option-bella');

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('bella');
  });

  it('opens the list on ArrowDown but skips navigation when nothing matches', () => {
    render(<ThreeOptionWrapper />);

    const input = screen.getByPlaceholderText('Search companion');
    fireEvent.change(input, { target: { value: 'zzz' } });
    expect(screen.queryByRole('button', { name: 'Buddy' })).not.toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).not.toHaveAttribute('aria-activedescendant');

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).not.toHaveAttribute('aria-activedescendant');
  });

  it('skips arrow navigation while the query is below min chars', () => {
    render(<ThreeOptionWrapper minChars={3} />);

    const input = screen.getByPlaceholderText('Search companion');
    fireEvent.change(input, { target: { value: 'b' } });

    // Matches exist, but the query is too short to search.
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).not.toHaveAttribute('aria-activedescendant');

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).not.toHaveAttribute('aria-activedescendant');
  });

  it('ignores Enter when the query is below min chars', () => {
    const onSelect = jest.fn();
    render(<ThreeOptionWrapper onSelect={onSelect} minChars={3} />);

    const input = screen.getByPlaceholderText('Search companion');
    fireEvent.change(input, { target: { value: 'b' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('ignores unhandled keys', () => {
    const onSelect = jest.fn();
    render(<ThreeOptionWrapper onSelect={onSelect} />);

    const input = screen.getByPlaceholderText('Search companion');
    fireEvent.change(input, { target: { value: 'b' } });
    fireEvent.keyDown(input, { key: 'Tab' });
    fireEvent.keyDown(input, { key: 'a' });

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Buddy' })).toBeInTheDocument();
  });

  it('ignores Enter while the list is searchable but no option is active', () => {
    const onSelect = jest.fn();
    const options = [
      { value: 'buddy', label: 'Buddy' },
      { value: 'bella', label: 'Bella' },
    ];
    const setQuery = jest.fn();

    const { rerender } = render(
      <SearchDropdown
        options={options}
        onSelect={onSelect}
        placeholder="Search"
        query="b"
        setQuery={setQuery}
        minChars={3}
      />
    );

    // Opening with a too-short query clears the active option.
    const input = screen.getByPlaceholderText('Search');
    fireEvent.focus(input);
    expect(input).not.toHaveAttribute('aria-activedescendant');

    // Lowering minChars alone makes the list searchable without re-deriving the
    // active option, so Enter has nothing to confirm.
    rerender(
      <SearchDropdown
        options={options}
        onSelect={onSelect}
        placeholder="Search"
        query="b"
        setQuery={setQuery}
        minChars={1}
      />
    );
    expect(screen.getByRole('button', { name: 'Buddy' })).toBeInTheDocument();
    expect(input).not.toHaveAttribute('aria-activedescendant');

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('re-anchors the active option when the filtered list shrinks past it', () => {
    render(<ThreeOptionWrapper />);

    const input = screen.getByPlaceholderText('Search companion');
    fireEvent.change(input, { target: { value: 'b' } });
    fireEvent.keyDown(input, { key: 'End' });
    expect(activeDescendant()).toContain('-option-bruno');

    // 'bel' matches only Bella, so the out-of-range active index resets to 0.
    fireEvent.change(input, { target: { value: 'bel' } });
    expect(activeDescendant()).toContain('-option-bella');
  });

  it('keeps a still-valid active option when the filtered list changes', () => {
    render(<ThreeOptionWrapper />);

    const input = screen.getByPlaceholderText('Search companion');
    fireEvent.change(input, { target: { value: 'b' } });
    expect(activeDescendant()).toContain('-option-buddy');

    // 'bu' still matches Buddy at index 0, so the active index survives the refilter.
    fireEvent.change(input, { target: { value: 'bu' } });
    expect(activeDescendant()).toContain('-option-buddy');
  });

  it('highlights the option under the pointer', () => {
    render(<ThreeOptionWrapper />);

    const input = screen.getByPlaceholderText('Search companion');
    fireEvent.change(input, { target: { value: 'b' } });

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Bruno' }));
    expect(activeDescendant()).toContain('-option-bruno');
  });

  it('closes on Escape pressed outside the input and ignores other document keys', () => {
    render(<ThreeOptionWrapper />);

    const input = screen.getByPlaceholderText('Search companion');
    fireEvent.change(input, { target: { value: 'b' } });
    expect(screen.getByRole('button', { name: 'Buddy' })).toBeInTheDocument();

    // A non-Escape key on the document leaves the list open.
    fireEvent.keyDown(document, { key: 'k' });
    expect(screen.getByRole('button', { name: 'Buddy' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('button', { name: 'Buddy' })).not.toBeInTheDocument();
  });

  it('shows every option when the query is only whitespace', () => {
    render(<ThreeOptionWrapper />);

    const input = screen.getByPlaceholderText('Search companion');
    fireEvent.change(input, { target: { value: ' ' } });

    expect(screen.getByRole('button', { name: 'Buddy' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bella' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bruno' })).toBeInTheDocument();
  });

  it('renders custom options with a custom class and label', () => {
    render(
      <SearchDropdown
        options={[
          { value: 'buddy', label: 'Buddy', meta: { breed: 'Beagle' } },
          { value: 'bella', label: 'Bella', meta: { breed: 'Boxer' } },
        ]}
        onSelect={jest.fn()}
        placeholder="Search"
        label="Find a companion"
        query="b"
        setQuery={jest.fn()}
        minChars={1}
        renderOption={(option) => (
          <span data-testid="custom-option">
            {option.label} — {(option.meta as { breed: string }).breed}
          </span>
        )}
        optionClassName="custom-option-class"
      />
    );

    const input = screen.getByRole('textbox', { name: 'Find a companion' });
    fireEvent.focus(input);

    expect(screen.getAllByTestId('custom-option')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /Buddy — Beagle/ })).toHaveClass(
      'custom-option-class'
    );
  });

  it('has no axe accessibility violations', async () => {
    const { container } = render(<Wrapper onSelect={jest.fn()} />);

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
