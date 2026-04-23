import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SpecialityCard from '@/app/features/organization/pages/Organization/Sections/Specialities/SpecialityCard';

jest.mock('@/app/ui/primitives/Accordion/Accordion', () => ({
  __esModule: true,
  default: ({ title, children, onDeleteClick }: any) => (
    <div>
      <div>{title}</div>
      <button type="button" onClick={onDeleteClick}>
        Delete
      </button>
      <div>{children}</div>
    </div>
  ),
}));

jest.mock('@/app/ui/inputs/FormInput/FormInput', () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange }: any) => (
    <label>
      {inlabel}
      <input value={value} onChange={onChange} aria-label={inlabel} />
    </label>
  ),
}));

jest.mock('@/app/ui/inputs/ServiceSearch/ServiceSearch', () => ({
  __esModule: true,
  default: () => <div>ServiceSearch</div>,
}));

describe('SpecialityCard', () => {
  it('updates and removes services', () => {
    const setFormData = jest.fn();
    const speciality = {
      services: [
        {
          name: 'Checkup',
          description: 'Initial',
          durationMinutes: 30,
          cost: 10,
          maxDiscount: 5,
        },
      ],
    } as any;

    render(<SpecialityCard setFormData={setFormData} speciality={speciality} index={0} />);

    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Updated' },
    });

    fireEvent.click(screen.getByText('Delete'));

    expect(setFormData).toHaveBeenCalled();
  });
});
