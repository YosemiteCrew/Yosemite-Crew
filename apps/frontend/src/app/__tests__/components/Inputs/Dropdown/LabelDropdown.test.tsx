import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';

jest.mock('react-icons/fa6', () => ({
  FaCaretDown: () => <span data-testid="icon-caret" />,
}));

expect.extend(toHaveNoViolations);

describe('LabelDropdown', () => {
  const options = [
    { label: 'Canine', value: 'dog' },
    { label: 'Feline', value: 'cat' },
  ];

  describe('hideLabel', () => {
    it('drops the stacked label but keeps it on the trigger for assistive tech', () => {
      render(<LabelDropdown placeholder="Room" options={options} onSelect={jest.fn()} hideLabel />);
      /* Omitted, not hidden with CSS: a hidden element keeps the same text in
         the accessibility tree and reappears the moment the selector that hides
         it stops matching - which is how the meta bar's label got duplicated. */
      const labels = screen.queryAllByText('Room').filter((node) => node.tagName !== 'BUTTON');
      expect(labels).toHaveLength(0);
      expect(screen.getByRole('button', { name: 'Room' })).toBeInTheDocument();
    });

    it('still renders the stacked label by default', () => {
      render(<LabelDropdown placeholder="Room" options={options} onSelect={jest.fn()} />);
      expect(screen.getAllByText('Room').some((node) => node.tagName === 'SPAN')).toBe(true);
    });
  });

  it('renders placeholder and error when no selection', () => {
    render(
      <LabelDropdown
        placeholder="Species"
        options={options}
        onSelect={jest.fn()}
        error="Required"
      />
    );

    expect(screen.getByRole('button', { name: /Species/i })).toBeInTheDocument();
    const trigger = screen.getByRole('button', { name: /Species/i });
    const error = screen.getByRole('alert');
    expect(error).toHaveTextContent('Required');
    expect(trigger).toHaveAttribute('aria-describedby', error.id);
  });

  it('opens and selects an option', () => {
    const onSelect = jest.fn();
    render(<LabelDropdown placeholder="Species" options={options} onSelect={onSelect} />);

    // Click the trigger button to open the dropdown
    fireEvent.click(screen.getByRole('button', { name: /Species/i }));
    fireEvent.click(screen.getByText('Feline'));

    expect(onSelect).toHaveBeenCalledWith({ label: 'Feline', value: 'cat' });
    expect(screen.getByText('Feline')).toBeInTheDocument();
  });

  it('selects an option with arrow keys and enter', () => {
    const onSelect = jest.fn();
    render(<LabelDropdown placeholder="Species" options={options} onSelect={onSelect} />);

    const trigger = screen.getByRole('button', { name: /Species/i });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'Enter' });

    expect(onSelect).toHaveBeenCalledWith({ label: 'Feline', value: 'cat' });
    expect(screen.getByText('Feline')).toBeInTheDocument();
  });

  it('supports Home, End and Space navigation', () => {
    const onSelect = jest.fn();
    render(<LabelDropdown placeholder="Species" options={options} onSelect={onSelect} />);

    const trigger = screen.getByRole('button', { name: /Species/i });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' }); // opens
    fireEvent.keyDown(trigger, { key: 'End' });
    fireEvent.keyDown(trigger, { key: 'Home' });
    fireEvent.keyDown(trigger, { key: ' ' }); // confirm first option

    expect(onSelect).toHaveBeenCalledWith({ label: 'Canine', value: 'dog' });
  });

  it('closes on Escape', () => {
    render(<LabelDropdown placeholder="Species" options={options} onSelect={jest.fn()} />);

    const trigger = screen.getByRole('button', { name: /Species/i });
    fireEvent.click(trigger);
    expect(screen.getByRole('textbox', { name: 'Search Species' })).toBeInTheDocument();

    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(screen.queryByRole('textbox', { name: 'Search Species' })).not.toBeInTheDocument();
  });

  it('renders a leading icon inside the top label', () => {
    render(
      <LabelDropdown
        placeholder="Species"
        options={options}
        onSelect={jest.fn()}
        icon={<span data-testid="label-icon" />}
      />
    );

    expect(screen.getByTestId('label-icon')).toBeInTheDocument();
  });

  it('preselects default option', () => {
    render(
      <LabelDropdown
        placeholder="Species"
        options={options}
        defaultOption="dog"
        onSelect={jest.fn()}
      />
    );

    expect(screen.getByText('Canine')).toBeInTheDocument();
  });

  it('keeps the placeholder when the default option matches nothing', () => {
    render(
      <LabelDropdown
        placeholder="Species"
        options={options}
        defaultOption="wolf"
        onSelect={jest.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Species' })).toBeInTheDocument();
    expect(screen.queryByText('Canine')).not.toBeInTheDocument();
    expect(screen.queryByText('Feline')).not.toBeInTheDocument();
  });

  it('preselects default option by label', () => {
    render(
      <LabelDropdown
        placeholder="Species"
        options={options}
        defaultOption="Feline"
        onSelect={jest.fn()}
      />
    );

    expect(screen.getByText('Feline')).toBeInTheDocument();
  });

  it('updates the displayed selection when default option changes', () => {
    const { rerender } = render(
      <LabelDropdown
        placeholder="Species"
        options={options}
        defaultOption="dog"
        onSelect={jest.fn()}
      />
    );

    rerender(
      <LabelDropdown
        placeholder="Species"
        options={options}
        defaultOption="cat"
        onSelect={jest.fn()}
      />
    );

    expect(screen.getByText('Feline')).toBeInTheDocument();
    expect(screen.queryByText('Canine')).not.toBeInTheDocument();
  });

  it('updates the display on click even when the controlled default is never fed back', () => {
    // Regression: a controlled consumer passes defaultOption but does not echo the
    // chosen value back into it. Before the fix the display stayed pinned to the
    // initial defaultOption; a user click must always move the label.
    const onSelect = jest.fn();
    render(
      <LabelDropdown
        placeholder="Species"
        options={options}
        defaultOption="dog"
        onSelect={onSelect}
      />
    );

    expect(screen.getByText('Canine')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Species/i }));
    fireEvent.click(screen.getByText('Feline'));

    expect(onSelect).toHaveBeenCalledWith({ label: 'Feline', value: 'cat' });
    expect(screen.getByText('Feline')).toBeInTheDocument();
    expect(screen.queryByText('Canine')).not.toBeInTheDocument();
  });

  it('keeps portaled options inside terminology locks', () => {
    render(
      <div data-terminology-lock="true">
        <LabelDropdown placeholder="Species" options={options} onSelect={jest.fn()} />
      </div>
    );

    fireEvent.click(screen.getByRole('button', { name: /Species/i }));

    expect(document.querySelector('[data-portal-dropdown][aria-label="Species"]')).toHaveAttribute(
      'data-terminology-lock',
      'true'
    );
  });

  it('filters searchable options and shows an empty state', () => {
    render(<LabelDropdown placeholder="Species" options={options} onSelect={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Species/i }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Search Species' }), {
      target: { value: 'wolf' },
    });

    expect(screen.getByText('No matches found')).toBeInTheDocument();
    expect(screen.queryByText('Canine')).not.toBeInTheDocument();
  });

  it('shows a custom empty state before searching', () => {
    render(
      <LabelDropdown
        placeholder="Species"
        options={[]}
        onSelect={jest.fn()}
        noOptionsMessage="No species available"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Species/i }));

    expect(screen.getByText('No species available')).toBeInTheDocument();
  });

  it('shows the default empty state when no options are available', () => {
    render(<LabelDropdown placeholder="Species" options={[]} onSelect={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Species/i }));

    // The same sentence the other two dropdown primitives use. This one said
    // "No options" while MultiSelectDropdown and Dropdown said "No options
    // available", so the same empty menu read two ways depending on the field.
    expect(screen.getByText('No options available')).toBeInTheDocument();
  });

  it('renders inline options when portal is disabled', () => {
    render(
      <LabelDropdown placeholder="Species" options={options} onSelect={jest.fn()} portal={false} />
    );

    fireEvent.click(screen.getByRole('button', { name: /Species/i }));

    expect(screen.getByText('Canine')).toBeInTheDocument();
    expect(document.querySelector('[data-portal-dropdown]')).toBeInTheDocument();
  });

  it('closes and clears search when clicking outside', () => {
    render(
      <div>
        <button type="button">Outside</button>
        <LabelDropdown placeholder="Species" options={options} onSelect={jest.fn()} />
      </div>
    );

    fireEvent.click(screen.getByRole('button', { name: /Species/i }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Search Species' }), {
      target: { value: 'cat' },
    });
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Outside' }));

    expect(screen.queryByRole('textbox', { name: 'Search Species' })).not.toBeInTheDocument();
  });

  it('repositions on resize and closes on outer scroll', () => {
    render(<LabelDropdown placeholder="Species" options={options} onSelect={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Species/i }));
    fireEvent.resize(globalThis.window);

    expect(screen.getByRole('textbox', { name: 'Search Species' })).toBeInTheDocument();

    fireEvent.scroll(globalThis.window);

    expect(screen.queryByRole('textbox', { name: 'Search Species' })).not.toBeInTheDocument();
  });

  it('stays open when scrolling inside the portaled options panel', () => {
    render(<LabelDropdown placeholder="Species" options={options} onSelect={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Species/i }));
    fireEvent.scroll(document.querySelector('[data-portal-dropdown]') as HTMLElement);

    expect(screen.getByRole('textbox', { name: 'Search Species' })).toBeInTheDocument();
  });

  it('toggles from the chevron icon without selecting an option', () => {
    const { container } = render(
      <LabelDropdown placeholder="Species" options={options} onSelect={jest.fn()} />
    );

    const chevron = container.querySelector('svg');
    expect(chevron).toBeInTheDocument();

    fireEvent.click(chevron as SVGElement);
    expect(screen.getByRole('textbox', { name: 'Search Species' })).toBeInTheDocument();

    fireEvent.click(chevron as SVGElement);
    expect(screen.queryByRole('textbox', { name: 'Search Species' })).not.toBeInTheDocument();
  });

  it('highlights the option under the pointer', () => {
    render(<LabelDropdown placeholder="Species" options={options} onSelect={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Species/i }));

    const felineOption = screen.getByText('Feline').closest('button')!;
    fireEvent.mouseEnter(felineOption);

    expect(felineOption).toHaveClass('bg-[var(--nav-active-bg)]');
    expect(screen.getByText('Canine').closest('button')).not.toHaveClass(
      'bg-[var(--nav-active-bg)]'
    );
  });

  it('navigates and confirms options from the search input', () => {
    const onSelect = jest.fn();
    render(<LabelDropdown placeholder="Species" options={options} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: /Species/i }));

    const search = screen.getByRole('textbox', { name: 'Search Species' });
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    fireEvent.keyDown(search, { key: 'Enter' });

    expect(onSelect).toHaveBeenCalledWith({ label: 'Feline', value: 'cat' });
  });

  it('renders a badge pill next to options that provide one', () => {
    render(
      <LabelDropdown
        placeholder="Service"
        options={[
          { label: 'Consultation', value: 'srv-1' },
          { label: 'Wellness Plan', value: 'pkg-1', badge: 'Package' },
        ]}
        onSelect={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Service/i }));

    expect(screen.getByText('Package')).toBeInTheDocument();
    // Non-badged option renders only its label.
    expect(screen.getByText('Consultation')).toBeInTheDocument();
  });

  it('has no axe accessibility violations', async () => {
    const { container } = render(
      <LabelDropdown placeholder="Species" options={options} onSelect={jest.fn()} />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
