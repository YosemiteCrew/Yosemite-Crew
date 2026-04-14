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
    fireEvent.click(screen.getByRole('button', { name: 'Vaccination & Booster Shots' }));

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
    fireEvent.click(screen.getByRole('button', { name: 'Add service “Home visit”' }));

    await waitFor(() => {
      expect(onAddService).toHaveBeenCalledWith('Home visit');
    });
    expect(onSelectService).not.toHaveBeenCalled();
  });
});
