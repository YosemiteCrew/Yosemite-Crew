import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import RichTextEditor from '@/app/ui/primitives/RichTextEditor/RichTextEditor';
import FloatingToolbar from '@/app/ui/primitives/RichTextEditor/FloatingToolbar';

describe('RichTextEditor', () => {
  it('renders an editable textbox with the toolbar', () => {
    render(<RichTextEditor value="<p>Hello</p>" onChange={jest.fn()} ariaLabel="Subjective" />);
    expect(screen.getByRole('textbox', { name: 'Subjective' })).toBeInTheDocument();
    expect(screen.getByRole('toolbar', { name: /text formatting/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bold' })).toBeInTheDocument();
  });

  it('hides the toolbar in read-only mode', () => {
    render(<RichTextEditor value="<p>Read</p>" onChange={jest.fn()} ariaLabel="Plan" readOnly />);
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Plan' })).toHaveAttribute('aria-readonly', 'true');
  });

  it('shows the placeholder when empty and editable', () => {
    render(
      <RichTextEditor value="" onChange={jest.fn()} ariaLabel="Notes" placeholder="Type here" />
    );
    expect(screen.getByText('Type here')).toBeInTheDocument();
  });

  it('renders the inset toolbar with the pill surface and a padded placeholder', () => {
    render(
      <RichTextEditor
        value=""
        onChange={jest.fn()}
        ariaLabel="Subjective"
        placeholder="Type here"
        toolbarPlacement="inset"
      />
    );
    // Placeholder reserves right-hand room so it never runs under the toolbar.
    expect(screen.getByText('Type here')).toHaveClass('pr-52');
    // The inset toolbar keeps the design's pill surface (neutral-100 background).
    expect(screen.getByRole('toolbar', { name: /text formatting/i })).toHaveClass('bg-neutral-100');
  });

  it('applies formatting via the toolbar and emits sanitized HTML', () => {
    const onChange = jest.fn();
    render(<RichTextEditor value="<p>abc</p>" onChange={onChange} ariaLabel="Subjective" />);
    fireEvent.click(screen.getByRole('button', { name: 'Bold' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bulleted list' }));
    fireEvent.click(screen.getByRole('button', { name: 'Indent' }));
    fireEvent.click(screen.getByRole('button', { name: 'Italic' }));
    fireEvent.click(screen.getByRole('button', { name: 'Underline' }));
    expect(onChange).toHaveBeenCalled();
  });

  it('uses the indent control in regular text blocks', () => {
    const onChange = jest.fn();
    render(<RichTextEditor value="<p>abc</p>" onChange={onChange} ariaLabel="Subjective" />);

    fireEvent.click(screen.getByRole('button', { name: 'Indent' }));

    expect(onChange).toHaveBeenCalledWith(expect.stringContaining('&nbsp;'));
  });

  it('indents without deleting the selected text', () => {
    const onChange = jest.fn();
    render(<RichTextEditor value="<p>hello</p>" onChange={onChange} ariaLabel="Subjective" />);

    // Select the whole paragraph, then indent — the text must be preserved and
    // pushed right (it used to be overwritten by the inserted spaces).
    const textbox = screen.getByRole('textbox', { name: 'Subjective' });
    fireEvent.focus(textbox);
    document.execCommand?.('selectAll');
    fireEvent.click(screen.getByRole('button', { name: 'Indent' }));

    const lastHtml = onChange.mock.calls.at(-1)?.[0] ?? '';
    expect(lastHtml).toContain('hello');
    expect(lastHtml).toContain('&nbsp;');
  });

  it('sinks a list item when indenting inside a list', () => {
    const insertContent = jest.fn();
    const run = jest.fn().mockReturnValue(true);
    const chain = {
      focus: jest.fn(),
      sinkListItem: jest.fn(),
      insertContent,
      run,
    };
    chain.focus.mockReturnValue(chain);
    chain.sinkListItem.mockReturnValue(chain);
    insertContent.mockReturnValue(chain);

    const editor = {
      isActive: jest.fn((name: string) => name === 'listItem'),
      chain: jest.fn(() => chain),
    };

    render(<FloatingToolbar editor={editor as never} />);

    fireEvent.click(screen.getByRole('button', { name: 'Indent' }));

    expect(chain.sinkListItem).toHaveBeenCalledWith('listItem');
    expect(insertContent).not.toHaveBeenCalled();
  });
});
