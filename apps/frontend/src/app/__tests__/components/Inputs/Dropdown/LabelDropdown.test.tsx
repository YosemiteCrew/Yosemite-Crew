import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';

jest.mock('react-icons/fa6', () => ({
  FaCaretDown: () => <span data-testid="icon-caret" />,
}));

jest.mock('react-icons/io', () => ({
  IoIosWarning: () => <span data-testid="icon-warning" />,
}));

expect.extend(toHaveNoViolations);

describe('LabelDropdown', () => {
  const options = [
    { label: 'Canine', value: 'dog' },
    { label: 'Feline', value: 'cat' },
  ];

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
    expect(screen.getByText('Required')).toBeInTheDocument();
    expect(screen.getByTestId('icon-warning')).toBeInTheDocument();
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

    expect(screen.getByText('No options')).toBeInTheDocument();
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
