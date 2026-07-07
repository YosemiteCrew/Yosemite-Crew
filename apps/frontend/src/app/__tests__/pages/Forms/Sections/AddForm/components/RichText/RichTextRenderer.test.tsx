import React from 'react';
import { render, screen } from '@testing-library/react';
import RichTextRenderer from '@/app/features/forms/pages/Forms/Sections/AddForm/components/RichText/RichTextRenderer';
import { FormField } from '@/app/features/forms/types/forms';

jest.mock('@/app/lib/richText', () => ({
  sanitizeRichText: jest.fn((html: string) => `sanitized:${html}`),
}));

jest.mock('@/app/ui/primitives/RichTextEditor/RichTextEditor', () => ({
  __esModule: true,
  default: ({ value, ariaLabel, placeholder, readOnly }: any) => (
    <textarea
      data-testid="mock-rich-text-editor"
      value={value}
      aria-label={ariaLabel}
      placeholder={placeholder}
      readOnly={readOnly}
      onChange={() => {}}
    />
  ),
}));

describe('RichTextRenderer', () => {
  const mockOnChange = jest.fn();
  const mockField = {
    id: 'rt-1',
    type: 'richtext',
    label: 'Notes',
    placeholder: 'Type here',
  } as FormField & { type: 'richtext' };

  describe('read-only mode', () => {
    it('renders the label and sanitized HTML content', () => {
      render(
        <RichTextRenderer field={mockField} value="<p>hi</p>" onChange={mockOnChange} readOnly />
      );
      expect(screen.getByText('Notes')).toBeInTheDocument();
      const html = document.querySelector('div[class*="min-h-22"]');
      expect(html?.innerHTML).toBe('sanitized:<p>hi</p>');
    });

    it('omits the label span when field.label is empty', () => {
      const noLabelField = { ...mockField, label: '' };
      render(
        <RichTextRenderer field={noLabelField} value="<p>hi</p>" onChange={mockOnChange} readOnly />
      );
      expect(screen.queryByText('Notes')).not.toBeInTheDocument();
    });

    it('sanitizes an empty string when value is nullish', () => {
      render(
        <RichTextRenderer
          field={mockField}
          value={undefined as unknown as string}
          onChange={mockOnChange}
          readOnly
        />
      );
      const html = document.querySelector('div[class*="min-h-22"]');
      expect(html?.innerHTML).toBe('sanitized:');
    });
  });

  describe('editable mode', () => {
    it('renders the label and the rich text editor with the provided value', () => {
      render(
        <RichTextRenderer field={mockField} value="<p>editable</p>" onChange={mockOnChange} />
      );
      expect(screen.getByText('Notes')).toBeInTheDocument();
      expect(screen.getByTestId('mock-rich-text-editor')).toHaveValue('<p>editable</p>');
    });

    it('falls back to an empty string when value is nullish', () => {
      render(
        <RichTextRenderer
          field={mockField}
          value={undefined as unknown as string}
          onChange={mockOnChange}
        />
      );
      expect(screen.getByTestId('mock-rich-text-editor')).toHaveValue('');
    });

    it('falls back to "Rich text" as the aria-label when field.label is empty', () => {
      const noLabelField = { ...mockField, label: '' };
      render(<RichTextRenderer field={noLabelField} value="" onChange={mockOnChange} />);
      expect(screen.getByTestId('mock-rich-text-editor')).toHaveAttribute(
        'aria-label',
        'Rich text'
      );
    });

    it('falls back to an empty placeholder when field.placeholder is not set', () => {
      const noPlaceholderField = { ...mockField, placeholder: undefined };
      render(<RichTextRenderer field={noPlaceholderField} value="" onChange={mockOnChange} />);
      expect(screen.getByTestId('mock-rich-text-editor')).toHaveAttribute('placeholder', '');
    });
  });
});
