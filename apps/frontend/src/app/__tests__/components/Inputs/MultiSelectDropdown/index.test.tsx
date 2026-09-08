import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import MultiSelectDropdown from '@/app/ui/inputs/MultiSelectDropdown';

jest.mock('react-icons/fa6', () => ({
  FaCaretDown: () => <span>caret</span>,
}));

describe('MultiSelectDropdown', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis.window, 'innerHeight', {
      configurable: true,
      value: 900,
    });
  });

  it('renders a badge pill next to options that provide one', () => {
    render(
      <MultiSelectDropdown
        placeholder="Select"
        value={[]}
        onChange={jest.fn()}
        options={[
          { label: 'Consult', value: 'srv-1', badge: 'Service' },
          { label: 'Wellness', value: 'pkg-1', badge: 'Package' },
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Select/i }));
    expect(screen.getByText('Service')).toBeInTheDocument();
    expect(screen.getByText('Package')).toBeInTheDocument();
  });

  it('adds and removes options', () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <MultiSelectDropdown
        placeholder="Select"
        value={[]}
        onChange={onChange}
        options={['One', 'Two']}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Select/i }));
    fireEvent.click(screen.getByRole('button', { name: 'One', pressed: false }));
    expect(onChange).toHaveBeenCalledWith(['One']);

    rerender(
      <MultiSelectDropdown
        placeholder="Select"
        value={['One']}
        onChange={onChange}
        options={['One', 'Two']}
      />
    );

    expect(screen.getByText('One')).toBeInTheDocument();

    const selectedOption = screen.getByRole('button', { name: 'One', pressed: true });
    fireEvent.click(selectedOption);
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('toggles options with arrow keys and enter', () => {
    const onChange = jest.fn();
    render(
      <MultiSelectDropdown
        placeholder="Select"
        value={[]}
        onChange={onChange}
        options={['One', 'Two']}
      />
    );

    const trigger = screen.getByRole('button', { name: /Select/i });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith(['Two']);
  });

  it('renders selected values inside the input as comma-separated text', () => {
    render(
      <MultiSelectDropdown
        placeholder="Support"
        value={['One', 'Two']}
        onChange={jest.fn()}
        options={['One', 'Two']}
      />
    );

    expect(screen.getByText('One, Two')).toBeInTheDocument();
    expect(screen.queryByText('remove')).not.toBeInTheDocument();
  });

  it('renders an error message and a top label with a leading icon', () => {
    render(
      <MultiSelectDropdown
        placeholder="Support"
        value={[]}
        onChange={jest.fn()}
        options={['One']}
        error="Pick at least one"
        icon={<span data-testid="ms-icon" />}
      />
    );

    expect(screen.getByText('Pick at least one')).toBeInTheDocument();
    expect(screen.getByTestId('ms-icon')).toBeInTheDocument();
  });

  it('supports Home, End, Space and Escape navigation', () => {
    const onChange = jest.fn();
    render(
      <MultiSelectDropdown
        placeholder="Select"
        value={[]}
        onChange={onChange}
        options={['One', 'Two', 'Three']}
      />
    );

    const trigger = screen.getByRole('button', { name: /Select/i });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' }); // opens
    fireEvent.keyDown(trigger, { key: 'End' });
    fireEvent.keyDown(trigger, { key: 'Home' });
    fireEvent.keyDown(trigger, { key: ' ' }); // toggle first option
    expect(onChange).toHaveBeenCalledWith(['One']);

    fireEvent.keyDown(trigger, { key: 'Escape' });
  });

  it('supports home, end, and escape while open', () => {
    const onChange = jest.fn();
    render(
      <MultiSelectDropdown
        placeholder="Select"
        value={[]}
        onChange={onChange}
        options={['One', 'Two', 'Three']}
      />
    );

    const trigger = screen.getByRole('button', { name: /Select/i });
    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: 'End' });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(['Three']);

    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: 'Home' });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(['One']);

    fireEvent.click(trigger);
    expect(screen.getByRole('button', { name: 'One', pressed: false })).toBeInTheDocument();
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(screen.queryByRole('button', { name: 'One', pressed: false })).not.toBeInTheDocument();
  });

  it('filters options and shows an empty search state', () => {
    render(
      <MultiSelectDropdown
        placeholder="Select"
        value={[]}
        onChange={jest.fn()}
        options={['Apple', 'Banana']}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Select/i }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'zzz' } });

    expect(screen.getByText('No matches found')).toBeInTheDocument();
  });

  it('shows the no-options state when there are no options', () => {
    render(
      <MultiSelectDropdown placeholder="Select" value={[]} onChange={jest.fn()} options={[]} />
    );

    fireEvent.click(screen.getByRole('button', { name: /Select/i }));
    expect(screen.getByText('No options available')).toBeInTheDocument();
  });

  it('resets an invalid selection when the available options change', () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <MultiSelectDropdown
        placeholder="Select"
        value={['Missing']}
        onChange={onChange}
        options={['One', 'Two']}
      />
    );

    expect(screen.getByRole('button', { name: /Select/i })).toBeInTheDocument();

    rerender(
      <MultiSelectDropdown
        placeholder="Select"
        value={['Missing']}
        onChange={onChange}
        options={['Two']}
      />
    );

    const trigger = screen.getByRole('button', { name: /Select/i });
    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(['Missing', 'Two']);
  });

  it('wraps the active option in both directions with ArrowDown and ArrowUp', () => {
    const onChange = jest.fn();
    render(
      <MultiSelectDropdown
        placeholder="Select"
        value={[]}
        onChange={onChange}
        options={['One', 'Two']}
      />
    );

    const trigger = screen.getByRole('button', { name: /Select/i });
    fireEvent.click(trigger); // open, active index 0

    fireEvent.keyDown(trigger, { key: 'ArrowDown' }); // 0 -> 1
    fireEvent.keyDown(trigger, { key: 'ArrowDown' }); // 1 -> wraps to 0
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith(['One']);

    fireEvent.keyDown(trigger, { key: 'ArrowUp' }); // 0 -> wraps to last (1)
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith(['Two']);

    fireEvent.keyDown(trigger, { key: 'ArrowUp' }); // 1 -> 0
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith(['One']);
  });

  it('opens the dropdown when a confirm key is pressed while closed', () => {
    render(
      <MultiSelectDropdown
        placeholder="Select"
        value={[]}
        onChange={jest.fn()}
        options={['One', 'Two']}
      />
    );

    const trigger = screen.getByRole('button', { name: /Select/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('ignores confirm and arrow keys when the filtered list is empty', () => {
    const onChange = jest.fn();
    render(
      <MultiSelectDropdown
        placeholder="Select"
        value={[]}
        onChange={onChange}
        options={['Apple', 'Banana']}
      />
    );

    const trigger = screen.getByRole('button', { name: /Select/i });
    fireEvent.click(trigger);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'zzz' } });
    expect(screen.getByText('No matches found')).toBeInTheDocument();

    fireEvent.keyDown(trigger, { key: 'ArrowDown' }); // no options -> early return
    fireEvent.keyDown(trigger, { key: 'Enter' }); // no active option -> early return
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does nothing for Home/End while closed and ignores unmapped keys', () => {
    const onChange = jest.fn();
    render(
      <MultiSelectDropdown
        placeholder="Select"
        value={[]}
        onChange={onChange}
        options={['One', 'Two']}
      />
    );

    const trigger = screen.getByRole('button', { name: /Select/i });
    fireEvent.keyDown(trigger, { key: 'Home' });
    fireEvent.keyDown(trigger, { key: 'End' });
    fireEvent.keyDown(trigger, { key: 'a' }); // default branch
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('handles key events dispatched on the search input', () => {
    const onChange = jest.fn();
    render(
      <MultiSelectDropdown
        placeholder="Select"
        value={[]}
        onChange={onChange}
        options={['One', 'Two']}
      />
    );

    const trigger = screen.getByRole('button', { name: /Select/i });
    fireEvent.click(trigger);
    const search = screen.getByRole('textbox');
    fireEvent.keyDown(search, { key: 'ArrowDown' }); // active 0 -> 1
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(['Two']);
  });

  it('renders the panel inline when the portal is disabled', () => {
    render(
      <MultiSelectDropdown
        placeholder="Select"
        value={[]}
        onChange={jest.fn()}
        options={['One', 'Two']}
        portal={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Select/i }));
    expect(screen.getByRole('button', { name: 'One', pressed: false })).toBeInTheDocument();
  });

  it('toggles the dropdown when the chevron icon is clicked', () => {
    const { container } = render(
      <MultiSelectDropdown placeholder="Select" value={[]} onChange={jest.fn()} options={['One']} />
    );

    const trigger = screen.getByRole('button', { name: /Select/i });
    const chevron = container.querySelector('svg');
    expect(chevron).not.toBeNull();

    fireEvent.click(chevron as SVGElement); // opens
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(container.querySelector('svg') as SVGElement); // closes
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes on an outside scroll but ignores scrolls inside the portal panel', () => {
    render(
      <MultiSelectDropdown
        placeholder="Select"
        value={[]}
        onChange={jest.fn()}
        options={['One', 'Two']}
      />
    );

    const trigger = screen.getByRole('button', { name: /Select/i });
    fireEvent.click(trigger);

    const panel = document.querySelector('[data-portal-dropdown]') as HTMLElement;
    expect(panel).not.toBeNull();

    // Recomputes position on resize while open (no crash, stays open).
    fireEvent(globalThis.window, new Event('resize'));
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    // Scroll originating inside the panel is ignored.
    fireEvent.scroll(panel);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    // Scroll outside the panel closes the dropdown.
    fireEvent.scroll(globalThis.window);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('highlights the option under the pointer', () => {
    render(
      <MultiSelectDropdown
        placeholder="Select"
        value={[]}
        onChange={jest.fn()}
        options={['One', 'Two']}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Select/i }));

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Two', pressed: false }));

    expect(screen.getByRole('button', { name: 'Two', pressed: false })).toHaveClass(
      'bg-card-hover'
    );
    expect(screen.getByRole('button', { name: 'One', pressed: false })).not.toHaveClass(
      'bg-card-hover'
    );
  });

  it('renders the empty state when no options prop is provided', () => {
    render(<MultiSelectDropdown placeholder="Select" value={[]} onChange={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Select/i }));
    expect(screen.getByText('No options available')).toBeInTheDocument();
  });
});
