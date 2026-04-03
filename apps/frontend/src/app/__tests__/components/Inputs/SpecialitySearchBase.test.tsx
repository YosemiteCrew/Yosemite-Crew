import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import SpecialitySearchBase from '@/app/ui/inputs/SpecialitySearch/SpecialitySearchBase';
import { useOrgStore } from '@/app/stores/orgStore';

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: jest.fn(),
}));

describe('SpecialitySearchBase', () => {
  const setSpecialities = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ primaryOrgId: 'org-1' })
    );
  });

  it('selects an existing speciality and closes dropdown', () => {
    render(
      <SpecialitySearchBase
        specialities={[]}
        currentSpecialities={[]}
        setSpecialities={setSpecialities}
      />
    );

    const input = screen.getByPlaceholderText('Search or create specialty');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'General Practice' } });

    fireEvent.click(screen.getByRole('button', { name: 'General Practice' }));

    expect(setSpecialities).toHaveBeenCalled();
    const updater = (setSpecialities as jest.Mock).mock.calls[0][0];
    expect(updater([])).toEqual([{ name: 'General Practice', organisationId: 'org-1' }]);
  });

  it('adds a custom speciality when there are no matches', () => {
    render(
      <SpecialitySearchBase
        specialities={[]}
        currentSpecialities={[]}
        setSpecialities={setSpecialities}
      />
    );

    const input = screen.getByPlaceholderText('Search or create specialty');
    fireEvent.change(input, { target: { value: 'new field' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add speciality “new field”' }));

    const updater = (setSpecialities as jest.Mock).mock.calls[0][0];
    expect(updater([])).toEqual([{ name: 'New field', organisationId: 'org-1' }]);
  });

  it('does nothing when primary org id is missing', () => {
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ primaryOrgId: '' })
    );

    render(
      <SpecialitySearchBase
        specialities={[]}
        currentSpecialities={[]}
        setSpecialities={setSpecialities}
      />
    );

    const input = screen.getByPlaceholderText('Search or create specialty');
    fireEvent.change(input, { target: { value: 'General' } });
    fireEvent.click(screen.getByRole('button', { name: 'General Practice' }));

    expect(setSpecialities).not.toHaveBeenCalled();
  });
});
