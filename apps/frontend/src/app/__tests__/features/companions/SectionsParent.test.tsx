import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Parent from '@/app/features/companions/components/Sections/Parent';
import { updateParent } from '@/app/features/companions/services/companionService';
import { CompanionParent } from '@/app/features/companions/pages/Companions/types';

jest.mock('@/app/features/companions/services/companionService', () => ({
  updateParent: jest.fn(),
}));

let capturedOnSave: ((values: any) => Promise<void>) | undefined;

jest.mock('@/app/ui/primitives/Accordion/EditableAccordion', () => ({
  __esModule: true,
  default: ({ title, data, onSave }: any) => {
    capturedOnSave = onSave;
    return (
      <div>
        <div data-testid="title">{title}</div>
        <div data-testid="data">{JSON.stringify(data)}</div>
      </div>
    );
  },
}));

const baseCompanion = {
  parent: {
    firstName: 'John',
    lastName: 'Doe',
    address: {
      addressLine: '123 Main St',
      city: 'Springfield',
      state: 'IL',
      postalCode: '62704',
    },
  },
} as unknown as CompanionParent;

describe('Sections/Parent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedOnSave = undefined;
  });

  it('renders parent info flattening address fields', () => {
    render(<Parent companion={baseCompanion} />);
    expect(screen.getByTestId('title')).toHaveTextContent('Parent information');
    const data = JSON.parse(screen.getByTestId('data').textContent ?? '{}');
    expect(data.addressLine).toBe('123 Main St');
    expect(data.city).toBe('Springfield');
    expect(data.state).toBe('IL');
    expect(data.postalCode).toBe('62704');
  });

  it('falls back to empty strings when address is missing', () => {
    render(
      <Parent
        companion={{ parent: { firstName: 'A', lastName: 'B' } } as unknown as CompanionParent}
      />
    );
    const data = JSON.parse(screen.getByTestId('data').textContent ?? '{}');
    expect(data.addressLine).toBe('');
    expect(data.city).toBe('');
    expect(data.state).toBe('');
    expect(data.postalCode).toBe('');
  });

  it('calls updateParent with merged firstName/lastName on save', async () => {
    (updateParent as jest.Mock).mockResolvedValue(undefined);
    render(<Parent companion={baseCompanion} />);

    await capturedOnSave?.({ firstName: 'Jane', lastName: 'Smith' });

    expect(updateParent).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: 'Jane', lastName: 'Smith' })
    );
  });

  it('logs the error when updateParent rejects', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const error = new Error('save failed');
    (updateParent as jest.Mock).mockRejectedValue(error);
    render(<Parent companion={baseCompanion} />);

    await capturedOnSave?.({ firstName: 'Jane', lastName: 'Smith' });

    expect(consoleSpy).toHaveBeenCalledWith(error);
    consoleSpy.mockRestore();
  });
});
