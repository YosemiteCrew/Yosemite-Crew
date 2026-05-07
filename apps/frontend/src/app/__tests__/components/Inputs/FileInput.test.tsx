import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';

import FileInput from '@/app/ui/inputs/FileInput/FileInput';

expect.extend(toHaveNoViolations);

describe('FileInput', () => {
  test('renders hidden file input with accessible label', () => {
    render(<FileInput />);

    const input = screen.getByLabelText('Upload documents (optional)');
    expect(input).toHaveAttribute('type', 'file');
    expect(input).toHaveAttribute('id', 'file-professioal-upload');

    expect(
      screen.getByText('Only DOC, PDF, PNG, and JPEG formats, with maximum size of 5 MB.')
    ).toBeInTheDocument();
  });

  test('has no axe accessibility violations', async () => {
    const { container } = render(<FileInput />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
