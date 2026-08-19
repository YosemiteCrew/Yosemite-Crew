import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import GoogleAddressFieldRenderer from '@/app/ui/primitives/Accordion/googleAddressFieldRenderer';

type MockAddress = {
  addressLine: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

jest.mock('@/app/ui/inputs/GoogleSearchDropDown/GoogleSearchDropDown', () => ({
  __esModule: true,
  default: ({
    inlabel,
    inname,
    value,
    error,
    onChange,
    onAddressSelect,
  }: {
    inlabel: string;
    inname?: string;
    value: string;
    error?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onAddressSelect?: (address: MockAddress) => void;
  }) => (
    <div>
      <input aria-label={inlabel} name={inname} value={value} onChange={onChange ?? (() => {})} />
      {error && <span role="alert">{error}</span>}
      <button
        type="button"
        onClick={() =>
          onAddressSelect?.({
            addressLine: '42 Main St',
            city: 'Springfield',
            state: 'IL',
            postalCode: '62704',
            country: 'US',
          })
        }
      >
        select-with-country
      </button>
      <button
        type="button"
        onClick={() =>
          onAddressSelect?.({
            addressLine: '7 Side Rd',
            city: 'Shelbyville',
            state: 'KY',
            postalCode: '40065',
            country: '',
          })
        }
      >
        select-without-country
      </button>
    </div>
  ),
}));

describe('GoogleAddressFieldRenderer', () => {
  const field = { key: 'addressLine', label: 'Address line' };

  it('renders the dropdown with the provided value, name, and label', () => {
    render(<GoogleAddressFieldRenderer field={field} value="123 Old Rd" onChange={jest.fn()} />);
    const input = screen.getByLabelText('Address line');
    expect(input).toHaveValue('123 Old Rd');
    expect(input).toHaveAttribute('name', 'addressLine');
  });

  it('falls back to an empty value when value is undefined', () => {
    render(<GoogleAddressFieldRenderer field={field} onChange={jest.fn()} />);
    expect(screen.getByLabelText('Address line')).toHaveValue('');
  });

  it('passes the error through to the dropdown', () => {
    render(
      <GoogleAddressFieldRenderer
        field={field}
        value=""
        error="Address line is required"
        onChange={jest.fn()}
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Address line is required');
  });

  it('calls onChange with the typed value', () => {
    const onChange = jest.fn();
    render(<GoogleAddressFieldRenderer field={field} value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Address line'), { target: { value: '9 New St' } });
    expect(onChange).toHaveBeenCalledWith('9 New St');
  });

  it('autofills sibling fields including country on address select', () => {
    const onChange = jest.fn();
    const onMultiChange = jest.fn();
    render(
      <GoogleAddressFieldRenderer
        field={field}
        value=""
        onChange={onChange}
        onMultiChange={onMultiChange}
      />
    );
    fireEvent.click(screen.getByText('select-with-country'));
    expect(onChange).toHaveBeenCalledWith('42 Main St');
    expect(onMultiChange).toHaveBeenCalledWith({
      city: 'Springfield',
      state: 'IL',
      postalCode: '62704',
      country: 'US',
    });
  });

  it('omits country from the multi-change payload when the address has none', () => {
    const onMultiChange = jest.fn();
    render(
      <GoogleAddressFieldRenderer
        field={field}
        value=""
        onChange={jest.fn()}
        onMultiChange={onMultiChange}
      />
    );
    fireEvent.click(screen.getByText('select-without-country'));
    expect(onMultiChange).toHaveBeenCalledWith({
      city: 'Shelbyville',
      state: 'KY',
      postalCode: '40065',
    });
    expect(onMultiChange.mock.calls[0][0]).not.toHaveProperty('country');
  });

  it('still applies the address line when onMultiChange is not provided', () => {
    const onChange = jest.fn();
    render(<GoogleAddressFieldRenderer field={field} value="" onChange={onChange} />);
    fireEvent.click(screen.getByText('select-with-country'));
    expect(onChange).toHaveBeenCalledWith('42 Main St');
  });
});
