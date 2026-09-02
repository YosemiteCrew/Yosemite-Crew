import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import InventoryTable from '@/app/ui/tables/InventoryTable';

const mockAllowedImageHosts = new Set(['cdn.example.com']);

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, src }: any) => {
    // Real next/image throws for any host missing from next.config's allowlist.
    const { hostname } = new URL(src);
    if (!mockAllowedImageHosts.has(hostname)) {
      throw new Error(
        `Invalid src prop (${src}) on \`next/image\`, hostname "${hostname}" is not configured under images in your next.config.js`
      );
    }
    return React.createElement('img', { alt, src });
  },
}));

// Auto-stub every io5 icon so any icon the source imports (and the pagination
// chevrons the Back/Next primitives render) resolves to a testable span.
jest.mock(
  'react-icons/io5',
  () =>
    new Proxy(
      { __esModule: true },
      {
        get: (_t, name) => {
          if (name === '__esModule') return true;
          const Icon =
            (_t as any)[String(name)] ||
            ((_t as any)[String(name)] = (props: any) => (
              <span data-testid={String(name)} onClick={props.onClick} />
            ));
          return Icon;
        },
      }
    )
);

// Mirrors the real pair: bare s3 keys resolve to the org CDN, while a full https
// URL is passed straight through whatever its host.
jest.mock('@/app/constants/mediaSources', () => ({
  MEDIA_SOURCES: {
    organization: { fromS3Key: (key: string) => `https://cdn.example.com/${key}` },
  },
}));

jest.mock('@/app/lib/urls', () => ({
  getSafeOrgImageUrl: jest.fn((src: string) => {
    if (typeof src !== 'string' || !src) return '';
    if (/^https:\/\/.+/i.test(src)) return src;
    return `https://cdn.example.com/${src}`;
  }),
}));

jest.mock('@/app/ui/cards/InventoryCard', () => ({
  __esModule: true,
  default: ({ item, handleViewInventory }: any) => (
    <div data-testid="mobile-card">
      <span>{item.basicInfo.name}</span>
      <button type="button" onClick={() => handleViewInventory(item)}>
        View Mobile
      </button>
    </div>
  ),
}));

// These helpers are mocked to COMPUTE from their input rather than return
// constants, so different row data drives the component's per-status branches
// (expired / low-stock styling, undefined margin, missing numeric fields).
jest.mock('@/app/features/inventory/pages/Inventory/utils', () => ({
  displayStatusLabel: (item: any) => item?.basicInfo?.status ?? 'Healthy',
  formatCurrencyValue: (value: string | number | undefined | null) =>
    value === undefined || value === null || value === '' ? '—' : `$ ${value}`,
  formatDisplayDate: (value?: string) => (value ? '01 Jan 2025' : ''),
  formatPercentValue: (value?: number) => (value === undefined ? '—' : `${value}%`),
  getAvailableStock: (item: any) => item?.stock?.available ?? item?.stock?.current,
  getMarginPercent: (item: any) => {
    const selling = item?.pricing?.selling;
    return selling === undefined || selling === null || selling === '' ? undefined : 50;
  },
  getStatusBadgeStyle: () => ({ backgroundColor: '#000', color: '#fff' }),
}));

/* The row branch and the card branch are gated by CSS media queries (DataTable.css),
   which jsdom does not apply — both are in the DOM, so pager queries must name a
   branch or they match twice. */
const tableBranch = (container: HTMLElement) =>
  within(container.querySelector('.inventory-table-list') as HTMLElement);
const cardBranch = (container: HTMLElement) =>
  within(container.querySelector('.inventory-card-list') as HTMLElement);

describe('InventoryTable', () => {
  const item = {
    id: 'item-1',
    basicInfo: {
      name: 'Vaccine',
      category: 'Medicine',
      status: 'Healthy',
    },
    stock: {
      current: 2,
      available: 4,
      stockLocation: 'Shelf A',
    },
    pricing: {
      purchaseCost: 5,
      selling: 10,
    },
    batch: {
      expiryDate: '2025-01-01',
    },
  } as any;

  const makeItem = (overrides: any = {}): any => ({
    ...item,
    ...overrides,
    basicInfo: { ...item.basicInfo, ...(overrides.basicInfo ?? {}) },
    stock: { ...item.stock, ...(overrides.stock ?? {}) },
    pricing: { ...item.pricing, ...(overrides.pricing ?? {}) },
    batch: { ...item.batch, ...(overrides.batch ?? {}) },
  });

  it('renders the card-table columns and the mobile cards', () => {
    render(
      <InventoryTable
        filteredList={[item]}
        setActiveInventory={jest.fn()}
        setViewInventory={jest.fn()}
      />
    );

    // The name appears in both the desktop row and the mobile card.
    expect(screen.getAllByText('Vaccine').length).toBeGreaterThan(0);
    // The rest of the columns only render in the desktop card-table.
    expect(screen.getByText('Medicine')).toBeInTheDocument();
    // On hand + available render with the abbreviated unit ("u").
    expect(screen.getByText('2 u')).toBeInTheDocument();
    expect(screen.getByText('4 u')).toBeInTheDocument();
    expect(screen.getByText('$ 5')).toBeInTheDocument();
    expect(screen.getByText('$ 10')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('01 Jan 2025')).toBeInTheDocument();
    expect(screen.getByText('Shelf A')).toBeInTheDocument();
    expect(screen.getByText('Healthy')).toBeInTheDocument();

    // Column headers describe the catalog.
    expect(screen.getByText('Stock health')).toBeInTheDocument();
    expect(screen.getByText('On hand')).toBeInTheDocument();

    const cards = screen.getAllByTestId('mobile-card');
    expect(cards).toHaveLength(1);
  });

  it('renders the footer summary', () => {
    const { container } = render(
      <InventoryTable
        filteredList={[item]}
        setActiveInventory={jest.fn()}
        setViewInventory={jest.fn()}
      />
    );

    expect(tableBranch(container).getByText('Showing 1–1 of 1 items')).toBeInTheDocument();
    // The card branch carries its own pager: below 1023 it is the only visible branch.
    expect(cardBranch(container).getByText('Showing 1–1 of 1 items')).toBeInTheDocument();
  });

  it('handles view action', () => {
    const setActiveInventory = jest.fn();
    const setViewInventory = jest.fn();

    render(
      <InventoryTable
        filteredList={[item]}
        setActiveInventory={setActiveInventory}
        setViewInventory={setViewInventory}
      />
    );

    fireEvent.click(screen.getByTestId('IoEye').closest('button')!);
    expect(setActiveInventory).toHaveBeenCalledWith(item);
    expect(setViewInventory).toHaveBeenCalledWith(true);
  });

  it('prefers onView over the legacy setters when provided', () => {
    const setActiveInventory = jest.fn();
    const setViewInventory = jest.fn();
    const onView = jest.fn();

    render(
      <InventoryTable
        filteredList={[item]}
        setActiveInventory={setActiveInventory}
        setViewInventory={setViewInventory}
        onView={onView}
      />
    );

    fireEvent.click(screen.getByTestId('IoEye').closest('button')!);
    expect(onView).toHaveBeenCalledWith(item);
    expect(setViewInventory).not.toHaveBeenCalled();
  });

  it('renders the restock action and fires onRestock', () => {
    const onRestock = jest.fn();

    render(
      <InventoryTable
        filteredList={[item]}
        setActiveInventory={jest.fn()}
        setViewInventory={jest.fn()}
        onRestock={onRestock}
      />
    );

    const restockBtn = screen.getByRole('button', { name: 'Restock Vaccine' });
    fireEvent.click(restockBtn);
    expect(onRestock).toHaveBeenCalledWith(item);
    // A healthy item keeps the neutral (non-highlighted) restock treatment.
    expect(restockBtn.className).toContain('grid-row-action');
  });

  it('exposes accessible labels for the action icons (tooltip triggers)', () => {
    render(
      <InventoryTable
        filteredList={[item]}
        setActiveInventory={jest.fn()}
        setViewInventory={jest.fn()}
        onRestock={jest.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'View Vaccine' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restock Vaccine' })).toBeInTheDocument();
  });

  it('renders an inventory image when the item stores an s3 key', () => {
    const itemWithImage = {
      ...item,
      basicInfo: {
        ...item.basicInfo,
        imageUrl: 'inventory/org-1/vaccine.jpg',
      },
    };

    render(
      <InventoryTable
        filteredList={[itemWithImage]}
        setActiveInventory={jest.fn()}
        setViewInventory={jest.fn()}
      />
    );

    expect(screen.getByAltText('')).toHaveAttribute(
      'src',
      'https://cdn.example.com/inventory/org-1/vaccine.jpg'
    );
  });

  it('falls back to the category emoji when the image is on an unconfigured host', () => {
    const itemWithForeignImage = {
      ...item,
      basicInfo: {
        ...item.basicInfo,
        imageUrl: 'https://images.example.org/not-allowlisted.png',
      },
    };

    expect(() =>
      render(
        <InventoryTable
          filteredList={[itemWithForeignImage]}
          setActiveInventory={jest.fn()}
          setViewInventory={jest.fn()}
        />
      )
    ).not.toThrow();

    expect(screen.queryByAltText('')).not.toBeInTheDocument();
    // The mocked mobile card renders no emoji, so the fallback is unique to the desktop row.
    expect(screen.getByText('💊')).toBeInTheDocument();
  });

  it('resolves the image from the top-level imageUrl when basicInfo lacks one', () => {
    const topImg = makeItem({ imageUrl: 'inventory/top.jpg' });

    render(
      <InventoryTable
        filteredList={[topImg]}
        setActiveInventory={jest.fn()}
        setViewInventory={jest.fn()}
      />
    );

    expect(screen.getByAltText('')).toHaveAttribute(
      'src',
      'https://cdn.example.com/inventory/top.jpg'
    );
  });

  it('applies expired styling (row tint + danger expiry) when the status is expired', () => {
    const expiredItem = makeItem({ basicInfo: { status: 'Expired' } });

    const { container } = render(
      <InventoryTable
        filteredList={[expiredItem]}
        setActiveInventory={jest.fn()}
        setViewInventory={jest.fn()}
      />
    );

    expect(screen.getByText('Expired')).toBeInTheDocument();
    // The expiry cell switches to the theme-aware danger ink only for expired rows.
    expect(container.querySelector('.cell-ink-danger')).toBeInTheDocument();
  });

  it('applies low-stock styling and the restock highlight when the status is low stock', () => {
    const lowItem = makeItem({ basicInfo: { status: 'Low stock' } });
    const onRestock = jest.fn();

    const { container } = render(
      <InventoryTable
        filteredList={[lowItem]}
        setActiveInventory={jest.fn()}
        setViewInventory={jest.fn()}
        onRestock={onRestock}
      />
    );

    expect(screen.getByText('Low stock')).toBeInTheDocument();
    // The available column emphasises low stock with the amber warn ink.
    expect(container.querySelector('.cell-ink-warn')).toBeInTheDocument();
    // The restock button gains the active-nav highlight for low-stock rows.
    const restockBtn = screen.getByRole('button', { name: 'Restock Vaccine' });
    expect(restockBtn.className).toContain('bg-[var(--nav-active-bg)]');
  });

  it('abbreviates box units as "bx" when the product name reads as a box', () => {
    const boxed = makeItem({ basicInfo: { name: 'Vaccine box' } });

    render(
      <InventoryTable
        filteredList={[boxed]}
        setActiveInventory={jest.fn()}
        setViewInventory={jest.fn()}
      />
    );

    expect(screen.getByText('2 bx')).toBeInTheDocument();
    expect(screen.getByText('4 bx')).toBeInTheDocument();
  });

  it('keeps an accurate restock action for expired rows (no disposal workflow)', () => {
    const onRestock = jest.fn();
    const expiredItem = makeItem({ basicInfo: { status: 'Expired' } });

    render(
      <InventoryTable
        filteredList={[expiredItem]}
        setActiveInventory={jest.fn()}
        setViewInventory={jest.fn()}
        onRestock={onRestock}
      />
    );

    // The action never disposes stock, so it must not claim to; expired rows keep
    // the restock label (their danger tint carries the "expired" signal instead).
    expect(screen.queryByRole('button', { name: 'Dispose Vaccine' })).not.toBeInTheDocument();
    const restockBtn = screen.getByRole('button', { name: 'Restock Vaccine' });
    fireEvent.click(restockBtn);
    expect(onRestock).toHaveBeenCalledWith(expiredItem);
  });

  it('renders the margin placeholder when the margin is undefined', () => {
    const noMargin = makeItem({ pricing: { purchaseCost: 5, selling: undefined } });

    render(
      <InventoryTable
        filteredList={[noMargin]}
        setActiveInventory={jest.fn()}
        setViewInventory={jest.fn()}
      />
    );

    // Both the selling and margin cells collapse to the em-dash placeholder.
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('renders the subcategory suffix when present', () => {
    const withSub = makeItem({ basicInfo: { subCategory: 'Antibiotic' } });

    render(
      <InventoryTable
        filteredList={[withSub]}
        setActiveInventory={jest.fn()}
        setViewInventory={jest.fn()}
      />
    );

    expect(screen.getByText(/Antibiotic/)).toBeInTheDocument();
  });

  it('falls back to an em dash for a missing category', () => {
    const noCat = makeItem({ basicInfo: { category: '' } });

    render(
      <InventoryTable
        filteredList={[noCat]}
        setActiveInventory={jest.fn()}
        setViewInventory={jest.fn()}
      />
    );

    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('renders the ABC class letter when present', () => {
    const withAbc = makeItem({ stock: { abcClass: 'Class B' } });

    render(
      <InventoryTable
        filteredList={[withAbc]}
        setActiveInventory={jest.fn()}
        setViewInventory={jest.fn()}
      />
    );

    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('renders dashes for missing on-hand, available, expiry, and location values', () => {
    // undefined stockLocation exercises the `val === undefined` guard, null the
    // `val === null` guard; an absent expiry date trips the `|| "—"` fallback.
    const noStock = makeItem({
      id: 'a',
      stock: { current: undefined, available: undefined, stockLocation: undefined },
      batch: { expiryDate: undefined },
    });
    const nullLoc = makeItem({ id: 'b', stock: { stockLocation: null } });

    render(
      <InventoryTable
        filteredList={[noStock, nullLoc]}
        setActiveInventory={jest.fn()}
        setViewInventory={jest.fn()}
      />
    );

    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('renders an em dash for an empty (blank string) stock location', () => {
    const emptyLoc = makeItem({ stock: { stockLocation: '' } });

    render(
      <InventoryTable
        filteredList={[emptyLoc]}
        setActiveInventory={jest.fn()}
        setViewInventory={jest.fn()}
      />
    );

    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('renders the skuCode when present', () => {
    const withSku = makeItem({ basicInfo: { skuCode: 'SKU-123' } });

    render(
      <InventoryTable
        filteredList={[withSku]}
        setActiveInventory={jest.fn()}
        setViewInventory={jest.fn()}
      />
    );

    expect(screen.getByText('SKU-123')).toBeInTheDocument();
  });

  it('falls back to the top-level sku when skuCode is absent', () => {
    const withSku = makeItem({ sku: 'TOP-SKU' });

    render(
      <InventoryTable
        filteredList={[withSku]}
        setActiveInventory={jest.fn()}
        setViewInventory={jest.fn()}
      />
    );

    expect(screen.getByText('TOP-SKU')).toBeInTheDocument();
  });

  it('renders category-specific image fallbacks when no image is present', () => {
    const items = [
      makeItem({ id: 's', basicInfo: { name: 'Surg', category: 'Surgical supply' } }),
      makeItem({ id: 'c', basicInfo: { name: 'Cons', category: 'Consumable' } }),
      makeItem({ id: 'f', basicInfo: { name: 'FoodItem', category: 'Food' } }),
      makeItem({ id: 'e', basicInfo: { name: 'Equip', category: 'Equipment' } }),
      makeItem({ id: 'm', basicInfo: { name: 'Med', category: 'Medicine' } }),
    ];

    render(
      <InventoryTable
        filteredList={items}
        setActiveInventory={jest.fn()}
        setViewInventory={jest.fn()}
      />
    );

    // Surgical + consumable both map to the gloves fallback.
    expect(screen.getAllByText('🧤').length).toBe(2);
    expect(screen.getByText('🥫')).toBeInTheDocument();
    expect(screen.getByText('🧰')).toBeInTheDocument();
    expect(screen.getAllByText('💊').length).toBeGreaterThan(0);
  });

  it('renders rows and cards for items without an id (key fallback to name)', () => {
    const noId = makeItem({ id: undefined, basicInfo: { name: 'NoId' } });

    render(
      <InventoryTable
        filteredList={[noId]}
        setActiveInventory={jest.fn()}
        setViewInventory={jest.fn()}
      />
    );

    expect(screen.getAllByText('NoId').length).toBeGreaterThan(0);
  });

  it('renders the empty states for the table, footer, and card list', () => {
    render(
      <InventoryTable
        filteredList={[]}
        setActiveInventory={jest.fn()}
        setViewInventory={jest.fn()}
      />
    );

    expect(screen.getAllByText('Nothing here yet').length).toBeGreaterThan(0);
    expect(screen.getByText('No items')).toBeInTheDocument();
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('paginates when there is more than one page of items', () => {
    const many = Array.from({ length: 9 }, (_, i) =>
      makeItem({ id: `p${i}`, basicInfo: { name: `Item ${i + 1}` } })
    );

    const { container } = render(
      <InventoryTable
        filteredList={many}
        setActiveInventory={jest.fn()}
        setViewInventory={jest.fn()}
      />
    );
    const pager = () => tableBranch(container);

    expect(pager().getByText('Showing 1–8 of 9 items')).toBeInTheDocument();
    expect(pager().getByLabelText('Page 1')).toHaveAttribute('aria-current', 'page');

    const prev = pager().getByRole('button', { name: 'Previous' });
    const next = pager().getByRole('button', { name: 'Next' });
    expect(prev).toBeDisabled();
    expect(next).not.toBeDisabled();

    fireEvent.click(next);
    expect(pager().getByText('Showing 9–9 of 9 items')).toBeInTheDocument();
    expect(pager().getByLabelText('Page 2')).toHaveAttribute('aria-current', 'page');
    expect(pager().getByRole('button', { name: 'Next' })).toBeDisabled();
    // Paging is shared state: the card branch must land on the same short last page.
    expect(cardBranch(container).getByText('Showing 9–9 of 9 items')).toBeInTheDocument();

    fireEvent.click(pager().getByRole('button', { name: 'Previous' }));
    expect(pager().getByText('Showing 1–8 of 9 items')).toBeInTheDocument();
  });

  it('clamps the current page when the list shrinks below it', () => {
    const many = Array.from({ length: 9 }, (_, i) =>
      makeItem({ id: `p${i}`, basicInfo: { name: `Item ${i + 1}` } })
    );

    const { rerender, container } = render(
      <InventoryTable
        filteredList={many}
        setActiveInventory={jest.fn()}
        setViewInventory={jest.fn()}
      />
    );

    fireEvent.click(tableBranch(container).getByRole('button', { name: 'Next' }));
    expect(tableBranch(container).getByLabelText('Page 2')).toHaveAttribute('aria-current', 'page');

    rerender(
      <InventoryTable
        filteredList={[makeItem({ id: 'solo', basicInfo: { name: 'Solo' } })]}
        setActiveInventory={jest.fn()}
        setViewInventory={jest.fn()}
      />
    );

    expect(tableBranch(container).getByText('Showing 1–1 of 1 items')).toBeInTheDocument();
  });
});
