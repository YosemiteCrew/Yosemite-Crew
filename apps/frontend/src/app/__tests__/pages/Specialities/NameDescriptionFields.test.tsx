import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import NameDescriptionFields from '@/app/features/organization/pages/Specialities/NameDescriptionFields';

describe('NameDescriptionFields', () => {
  const defaultProps = {
    name: 'Wellness Package',
    onNameChange: jest.fn(),
    descId: 'desc-1',
    description: 'Annual wellness check',
    onDescriptionChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the Name input with the provided value', () => {
    render(<NameDescriptionFields {...defaultProps} />);
    expect(screen.getByLabelText('Name')).toHaveValue('Wellness Package');
  });

  it('renders the Description textarea with the provided value and id', () => {
    render(<NameDescriptionFields {...defaultProps} />);
    const textarea = screen.getByLabelText('Description');
    expect(textarea.tagName).toBe('TEXTAREA');
    expect(textarea).toHaveValue('Annual wellness check');
    expect(textarea).toHaveAttribute('id', 'desc-1');
  });

  it('calls onNameChange with the typed value', () => {
    render(<NameDescriptionFields {...defaultProps} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Premium Package' } });
    expect(defaultProps.onNameChange).toHaveBeenCalledWith('Premium Package');
  });

  it('calls onDescriptionChange with the typed value', () => {
    render(<NameDescriptionFields {...defaultProps} />);
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Updated description' },
    });
    expect(defaultProps.onDescriptionChange).toHaveBeenCalledWith('Updated description');
  });

  it('shows the name error when nameError is provided', () => {
    render(<NameDescriptionFields {...defaultProps} nameError="Name is required." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Name is required.');
  });

  it('does not render an error when nameError is omitted', () => {
    render(<NameDescriptionFields {...defaultProps} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('omits the rows attribute by default', () => {
    render(<NameDescriptionFields {...defaultProps} />);
    expect(screen.getByLabelText('Description')).not.toHaveAttribute('rows');
  });

  it('applies textareaRows to the textarea when provided', () => {
    render(<NameDescriptionFields {...defaultProps} textareaRows={3} />);
    expect(screen.getByLabelText('Description')).toHaveAttribute('rows', '3');
  });
});
