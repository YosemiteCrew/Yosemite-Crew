import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import ServiceSearchBase from '@/app/ui/inputs/ServiceSearch/ServiceSearchBase';

const speciality = {
  name: 'General Practice',
  services: [{ name: 'General Consult' }],
} as any;

describe('ServiceSearchBase', () => {
  it('selects a known service', async () => {
    const onSelectService = jest.fn().mockResolvedValue(undefined);
    const onAddService = jest.fn().mockResolvedValue(undefined);

    render(
      <ServiceSearchBase
        speciality={speciality}
        onSelectService={onSelectService}
        onAddService={onAddService}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Search or create service'), {
      target: { value: 'Vaccination' },
    });
    fireEvent.click(screen.getByRole('option', { name: 'Vaccination & Booster Shots' }));

    await waitFor(() => {
      expect(onSelectService).toHaveBeenCalledWith('Vaccination & Booster Shots');
    });
  });

  it('adds a custom service when no match exists', async () => {
    const onSelectService = jest.fn().mockResolvedValue(undefined);
    const onAddService = jest.fn().mockResolvedValue(undefined);

    render(
      <ServiceSearchBase
        speciality={speciality}
        onSelectService={onSelectService}
        onAddService={onAddService}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Search or create service'), {
      target: { value: 'Home visit' },
    });
    fireEvent.click(screen.getByRole('option', { name: 'Add service “Home visit”' }));

    await waitFor(() => {
      expect(onAddService).toHaveBeenCalledWith('Home visit');
    });
    expect(onSelectService).not.toHaveBeenCalled();
  });

  it('moves the highlight with ArrowDown and selects it with Enter', async () => {
    const onSelectService = jest.fn().mockResolvedValue(undefined);
    const onAddService = jest.fn().mockResolvedValue(undefined);

    render(
      <ServiceSearchBase
        speciality={speciality}
        onSelectService={onSelectService}
        onAddService={onAddService}
      />
    );

    const input = screen.getByPlaceholderText('Search or create service');
    fireEvent.focus(input);
    // Catalogue order (General Consult excluded, already on the speciality):
    // Vaccination & Booster Shots, Health Certificate, ... Opening seeds the
    // highlight on the first row, so one ArrowDown reaches the second.
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(onSelectService).toHaveBeenCalledWith('Health Certificate');
    });
    expect(onAddService).not.toHaveBeenCalled();
  });

  it('adds a custom service via ArrowDown + Enter when nothing matches', async () => {
    const onSelectService = jest.fn().mockResolvedValue(undefined);
    const onAddService = jest.fn().mockResolvedValue(undefined);

    render(
      <ServiceSearchBase
        speciality={speciality}
        onSelectService={onSelectService}
        onAddService={onAddService}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Search or create service'), {
      target: { value: 'Zzz not in catalogue' },
    });
    const input = screen.getByPlaceholderText('Search or create service');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(onAddService).toHaveBeenCalledWith('Zzz not in catalogue');
    });
    expect(onSelectService).not.toHaveBeenCalled();
  });

  it('closes the results listbox on Escape without selecting anything', () => {
    const onSelectService = jest.fn().mockResolvedValue(undefined);
    const onAddService = jest.fn().mockResolvedValue(undefined);

    render(
      <ServiceSearchBase
        speciality={speciality}
        onSelectService={onSelectService}
        onAddService={onAddService}
      />
    );

    const input = screen.getByPlaceholderText('Search or create service');
    fireEvent.focus(input);
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onSelectService).not.toHaveBeenCalled();
    expect(onAddService).not.toHaveBeenCalled();
  });
});
