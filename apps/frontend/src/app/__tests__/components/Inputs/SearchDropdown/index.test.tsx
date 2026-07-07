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

  it('has no axe accessibility violations', async () => {
    const { container } = render(<Wrapper onSelect={jest.fn()} />);

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
