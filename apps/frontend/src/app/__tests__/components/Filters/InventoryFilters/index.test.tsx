import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import InventoryFilters from '@/app/ui/filters/InventoryFilters';

jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => ({
  __esModule: true,
  default: ({ placeholder, onSelect, options }: any) => (
    <div>
      <span>{placeholder}</span>
      <button type="button" onClick={() => onSelect(options[1])}>
        pick-category
      </button>
    </div>
  ),
}));

const getPanel = () => document.querySelector('.yc-glass-overlay') as HTMLElement | null;

describe('InventoryFilters', () => {
  it('updates visibility and category', () => {
    const onChange = jest.fn();
    render(
      <InventoryFilters
        filters={{ status: 'ALL', visibility: 'ALL', category: 'all' } as any}
        onChange={onChange}
        categories={['Food']}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Active' }));
    expect(onChange).toHaveBeenCalledWith({
      status: 'ALL',
      visibility: 'ACTIVE',
      category: 'all',
    });

    fireEvent.click(screen.getByRole('button', { name: 'pick-category' }));
    expect(onChange).toHaveBeenCalledWith({
      status: 'ALL',
      visibility: 'ALL',
      category: 'Food',
    });
  });

  it('renders the ACTIVE visibility slider position', () => {
    const { container } = render(
      <InventoryFilters
        filters={{ status: 'ALL', visibility: 'ACTIVE', category: 'all' } as any}
        onChange={jest.fn()}
        categories={['Food']}
      />
    );
    expect(container.querySelector('.translate-x-full')).toBeInTheDocument();
  });

  it('renders the HIDDEN visibility slider position', () => {
    const { container } = render(
      <InventoryFilters
        filters={{ status: 'ALL', visibility: 'HIDDEN', category: 'all' } as any}
        onChange={jest.fn()}
        categories={['Food']}
      />
    );
    expect(container.querySelector('.translate-x-\\[200\\%\\]')).toBeInTheDocument();
  });

  it('defaults visibility to ALL when not provided', () => {
    const { container } = render(
      <InventoryFilters
        filters={{ status: 'ALL', category: 'all' } as any}
        onChange={jest.fn()}
        categories={['Food']}
      />
    );
    expect(container.querySelector('.translate-x-0')).toBeInTheDocument();
  });

  it('resets category to "all" when the current category is not in the list', () => {
    const onChange = jest.fn();
    render(
      <InventoryFilters
        filters={{ status: 'ALL', visibility: 'ALL', category: 'Stale' } as any}
        onChange={onChange}
        categories={['Food']}
      />
    );
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ category: 'all' }));
  });

  it('shows the selected non-ALL stock health label on the pill', () => {
    render(
      <InventoryFilters
        filters={{ status: 'HEALTHY', visibility: 'ALL', category: 'all' } as any}
        onChange={jest.fn()}
        categories={['Food']}
      />
    );
    // The pill shows the selected option name rather than the "Stock health" placeholder.
    expect(screen.getByRole('button', { name: /Healthy/ })).toBeInTheDocument();
  });

  it('falls back to the first stock health option when the status matches none', () => {
    render(
      <InventoryFilters
        filters={{ status: 'MYSTERY', visibility: 'ALL', category: 'all' } as any}
        onChange={jest.fn()}
        categories={['Food']}
      />
    );
    // selectedStockHealth falls back to the ALL option, so the pill shows the placeholder.
    expect(screen.getByRole('button', { name: /Stock health/ })).toBeInTheDocument();
  });

  it('opens the stock health dropdown and selects an option', () => {
    const onChange = jest.fn();
    render(
      <InventoryFilters
        filters={{ status: 'HEALTHY', visibility: 'ALL', category: 'all' } as any}
        onChange={onChange}
        categories={['Food']}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Healthy/ }));
    const panel = getPanel();
    expect(panel).toBeInTheDocument();

    // All five options are rendered inside the portal panel.
    expect(within(panel!).getByText('All')).toBeInTheDocument();
    expect(within(panel!).getByText('Low stock')).toBeInTheDocument();
    expect(within(panel!).getByText('Expiring soon')).toBeInTheDocument();
    expect(within(panel!).getByText('Expired')).toBeInTheDocument();

    fireEvent.click(within(panel!).getByText('Low stock'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ status: 'LOW_STOCK' }));
    // Dropdown closes after a selection.
    expect(getPanel()).not.toBeInTheDocument();
  });

  it('selecting the ALL option updates status to ALL', () => {
    const onChange = jest.fn();
    render(
      <InventoryFilters
        filters={{ status: 'ALL', visibility: 'ALL', category: 'all' } as any}
        onChange={onChange}
        categories={['Food']}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Stock health/ }));
    const panel = getPanel();
    expect(panel).toBeInTheDocument();

    fireEvent.click(within(panel!).getByText('All'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ status: 'ALL' }));
  });

  it('closes the dropdown on an outside mousedown but stays open for inside interactions', () => {
    render(
      <InventoryFilters
        filters={{ status: 'ALL', visibility: 'ALL', category: 'all' } as any}
        onChange={jest.fn()}
        categories={['Food']}
      />
    );

    const trigger = screen.getByRole('button', { name: /Stock health/ });

    // Mousedown on the trigger keeps it open (trigger contains the target).
    fireEvent.click(trigger);
    expect(getPanel()).toBeInTheDocument();
    fireEvent.mouseDown(trigger);
    expect(getPanel()).toBeInTheDocument();

    // Mousedown inside the panel keeps it open (panel contains the target).
    fireEvent.mouseDown(getPanel()!);
    expect(getPanel()).toBeInTheDocument();

    // Mousedown outside closes it.
    fireEvent.mouseDown(document.body);
    expect(getPanel()).not.toBeInTheDocument();
  });

  it('closes the dropdown on scroll', () => {
    render(
      <InventoryFilters
        filters={{ status: 'ALL', visibility: 'ALL', category: 'all' } as any}
        onChange={jest.fn()}
        categories={['Food']}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Stock health/ }));
    expect(getPanel()).toBeInTheDocument();

    fireEvent.scroll(window);
    expect(getPanel()).not.toBeInTheDocument();
  });

  it('cleans up listeners on unmount without leaving the panel open', () => {
    const { unmount } = render(
      <InventoryFilters
        filters={{ status: 'ALL', visibility: 'ALL', category: 'all' } as any}
        onChange={jest.fn()}
        categories={['Food']}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Stock health/ }));
    expect(getPanel()).toBeInTheDocument();
    unmount();
    expect(getPanel()).not.toBeInTheDocument();
  });
});
