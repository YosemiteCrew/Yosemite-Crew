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

  it('hides the placeholder when external template content is applied after mount', () => {
    const { rerender } = render(
      <RichTextEditor value="" onChange={jest.fn()} ariaLabel="Notes" placeholder="Type here" />
    );

    expect(screen.getByText('Type here')).toBeInTheDocument();

    rerender(
      <RichTextEditor
        value="<p>Template prefilled content</p>"
        onChange={jest.fn()}
        ariaLabel="Notes"
        placeholder="Type here"
      />
    );

    expect(screen.queryByText('Type here')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Notes' })).toHaveTextContent(
      'Template prefilled content'
    );
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

  // #1907 regression: the editor used to list `value`/`onChange` as useEditor deps,
  // so every keystroke (which grows the controlled `value` and passes a fresh inline
  // onChange) destroyed and rebuilt the editor — resetting DOM focus and the cursor
  // after a single character. The editor must now be created once: the ProseMirror
  // textbox DOM node stays identical across value/onChange prop changes.
  it('does not remount the editor when value and onChange change (keystroke stability)', () => {
    const { rerender } = render(
      <RichTextEditor value="<p>a</p>" onChange={() => {}} ariaLabel="Subjective" />
    );
    const firstNode = screen.getByRole('textbox', { name: 'Subjective' });

    // Mimic a controlled keystroke: value grows and a brand-new onChange reference
    // is passed. Previously this recreated the editor (new textbox node).
    rerender(<RichTextEditor value="<p>ab</p>" onChange={() => {}} ariaLabel="Subjective" />);
    const secondNode = screen.getByRole('textbox', { name: 'Subjective' });

    expect(secondNode).toBe(firstNode);
    // External value change is still reflected into the surviving editor instance.
    expect(secondNode).toHaveTextContent('ab');
  });

  // #1907: onChange is read through a ref, so a doc change always calls the LATEST
  // handler even though changing it no longer recreates the editor.
  it('invokes the latest onChange after the handler prop changes', () => {
    const firstHandler = jest.fn();
    const secondHandler = jest.fn();
    const { rerender } = render(
      <RichTextEditor value="<p>abc</p>" onChange={firstHandler} ariaLabel="Subjective" />
    );
    rerender(<RichTextEditor value="<p>abc</p>" onChange={secondHandler} ariaLabel="Subjective" />);
    // Ignore any mount-time normalization update; only the post-swap edit matters.
    firstHandler.mockClear();
    secondHandler.mockClear();

    // Indent inserts content → a document change → onUpdate fires. It must reach the
    // CURRENT handler (secondHandler), proving the editor wasn't rebuilt with a stale
    // closure over the old handler.
    fireEvent.click(screen.getByRole('button', { name: 'Indent' }));

    expect(secondHandler).toHaveBeenCalled();
    expect(firstHandler).not.toHaveBeenCalled();
  });
});
