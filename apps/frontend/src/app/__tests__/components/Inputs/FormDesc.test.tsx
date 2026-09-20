import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import FormDesc from '@/app/ui/inputs/FormDesc/FormDesc';

describe('FormDesc', () => {
  test('renders textarea with label', () => {
    render(
      <FormDesc
        intype="text"
        inname="bio"
        inlabel="Biography"
        value="Vet with 10 years of experience"
        onChange={jest.fn()}
      />
    );

    const textarea = screen.getByLabelText<HTMLTextAreaElement>('Biography');
    expect(textarea.value).toBe('Vet with 10 years of experience');
  });

  test('calls onChange with new value', () => {
    let seen: string | null = null;
    const handleChange = jest.fn((e: React.ChangeEvent<HTMLTextAreaElement>) => {
      // Read immediately while the handler runs
      seen = e.target.value; // or e.currentTarget.value
    });

    render(
      <FormDesc intype="text" inname="bio" inlabel="Biography" value="" onChange={handleChange} />
    );

    const textarea = screen.getByLabelText<HTMLTextAreaElement>('Biography');
    fireEvent.change(textarea, { target: { value: 'New bio' } });

    expect(handleChange).toHaveBeenCalled();
    expect(seen).toBe('New bio');
  });

  test('displays error text', () => {
    render(
      <FormDesc
        intype="text"
        inname="bio"
        inlabel="Biography"
        value=""
        onChange={jest.fn()}
        error="Description required"
      />
    );

    expect(screen.getByText('Description required')).toBeInTheDocument();
  });

  test('applies custom className, readonly, and fires focus/blur', () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    render(
      <FormDesc
        intype="text"
        inname="bio"
        inlabel="Biography"
        value="hello"
        onChange={jest.fn()}
        onFocus={onFocus}
        onBlur={onBlur}
        readonly
        className="min-h-[200px]"
      />
    );

    const textarea = screen.getByLabelText<HTMLTextAreaElement>('Biography');
    expect(textarea.className).toContain('min-h-[200px]');
    expect(textarea).toHaveAttribute('readonly');

    fireEvent.focus(textarea);
    fireEvent.blur(textarea);
    expect(onFocus).toHaveBeenCalled();
    expect(onBlur).toHaveBeenCalled();
  });

  test('renders an undefined value as an empty textarea', () => {
    render(
      <FormDesc
        intype="text"
        inname="bio"
        inlabel="Biography"
        value={undefined as unknown as string}
        onChange={jest.fn()}
      />
    );

    expect(screen.getByLabelText<HTMLTextAreaElement>('Biography').value).toBe('');
  });

  test('uses the label as a placeholder and exposes hint and disabled states', () => {
    render(
      <FormDesc
        intype="text"
        inname="bio"
        inlabel="Biography"
        value=""
        onChange={jest.fn()}
        hint="Keep it concise."
        disabled
      />
    );

    const textarea = screen.getByLabelText<HTMLTextAreaElement>('Biography');
    expect(textarea).toHaveAttribute('placeholder', 'Biography');
    expect(textarea).toHaveAttribute('aria-describedby', screen.getByText('Keep it concise.').id);
    expect(textarea).toBeDisabled();
  });

  test('renders the static top label tied to the textarea', () => {
    render(
      <FormDesc intype="text" inname="bio" inlabel="Biography" value="" onChange={jest.fn()} />
    );

    const label = screen.getByText('Biography');
    expect(label.tagName).toBe('LABEL');
    const textarea = screen.getByLabelText('Biography');
    expect(label).toHaveAttribute('for', textarea.getAttribute('id') ?? '');
  });
});
