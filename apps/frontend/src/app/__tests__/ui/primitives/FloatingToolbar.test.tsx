import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import FloatingToolbar from '@/app/ui/primitives/RichTextEditor/FloatingToolbar';

type ChainMock = {
  focus: jest.Mock;
  toggleBold: jest.Mock;
  toggleItalic: jest.Mock;
  toggleUnderline: jest.Mock;
  toggleBulletList: jest.Mock;
  sinkListItem: jest.Mock;
  insertContentAt: jest.Mock;
  setTextSelection: jest.Mock;
  run: jest.Mock;
};

const createChainMock = (sinkListItemResult = true): ChainMock => {
  const chain: Partial<ChainMock> = {};
  chain.focus = jest.fn(() => chain);
  chain.toggleBold = jest.fn(() => chain);
  chain.toggleItalic = jest.fn(() => chain);
  chain.toggleUnderline = jest.fn(() => chain);
  chain.toggleBulletList = jest.fn(() => chain);
  chain.insertContentAt = jest.fn(() => chain);
  chain.setTextSelection = jest.fn(() => chain);
  chain.run = jest.fn(() => sinkListItemResult);
  chain.sinkListItem = jest.fn(() => chain);
  return chain as ChainMock;
};

const createEditorMock = (opts?: { activeNames?: string[]; sinkListItemResult?: boolean }) => {
  const activeNames = new Set(opts?.activeNames ?? []);
  const chain = createChainMock(opts?.sinkListItemResult ?? true);
  return {
    isActive: jest.fn((name: string) => activeNames.has(name)),
    chain: jest.fn(() => chain),
    state: {
      selection: {
        from: 5,
        to: 5,
        $from: { start: () => 0 },
      },
    },
    __chain: chain,
  } as any;
};

describe('FloatingToolbar', () => {
  it('renders a labeled toolbar with all 5 buttons', () => {
    const editor = createEditorMock();
    render(<FloatingToolbar editor={editor} />);
    expect(screen.getByRole('toolbar', { name: 'Text formatting' })).toBeInTheDocument();
    ['Bold', 'Italic', 'Underline', 'Bulleted list', 'Indent'].forEach((label) => {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    });
  });

  it('marks a button pressed when its mark is active', () => {
    const editor = createEditorMock({ activeNames: ['bold'] });
    render(<FloatingToolbar editor={editor} />);
    expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Italic' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('the indent button is never marked as pressed', () => {
    const editor = createEditorMock({ activeNames: ['bold'] });
    render(<FloatingToolbar editor={editor} />);
    expect(screen.getByRole('button', { name: 'Indent' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('toggles bold via the chain API on click', () => {
    const editor = createEditorMock();
    render(<FloatingToolbar editor={editor} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bold' }));
    expect(editor.__chain.toggleBold).toHaveBeenCalled();
    expect(editor.__chain.run).toHaveBeenCalled();
  });

  it('toggles italic, underline, and bullet list via their chain calls', () => {
    const editor = createEditorMock();
    render(<FloatingToolbar editor={editor} />);
    fireEvent.click(screen.getByRole('button', { name: 'Italic' }));
    expect(editor.__chain.toggleItalic).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Underline' }));
    expect(editor.__chain.toggleUnderline).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Bulleted list' }));
    expect(editor.__chain.toggleBulletList).toHaveBeenCalled();
  });

  it('prevents default on mousedown so the editor selection is preserved', () => {
    const editor = createEditorMock();
    render(<FloatingToolbar editor={editor} />);
    const button = screen.getByRole('button', { name: 'Bold' });
    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    const preventDefaultSpy = jest.spyOn(event, 'preventDefault');
    button.dispatchEvent(event);
    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('sinks the list item when indenting inside a list item and sinkListItem succeeds', () => {
    const editor = createEditorMock({ activeNames: ['listItem'], sinkListItemResult: true });
    render(<FloatingToolbar editor={editor} />);
    fireEvent.click(screen.getByRole('button', { name: 'Indent' }));
    expect(editor.__chain.sinkListItem).toHaveBeenCalledWith('listItem');
    expect(editor.__chain.insertContentAt).not.toHaveBeenCalled();
  });

  it('falls back to inserting visible indentation when not in a list item', () => {
    const editor = createEditorMock({ activeNames: [] });
    render(<FloatingToolbar editor={editor} />);
    fireEvent.click(screen.getByRole('button', { name: 'Indent' }));
    expect(editor.__chain.insertContentAt).toHaveBeenCalledWith(0, '    ');
    expect(editor.__chain.setTextSelection).toHaveBeenCalledWith({ from: 9, to: 9 });
  });

  it('falls back to inserting visible indentation when sinkListItem run() reports failure', () => {
    const editor = createEditorMock({ activeNames: ['listItem'], sinkListItemResult: false });
    render(<FloatingToolbar editor={editor} />);
    fireEvent.click(screen.getByRole('button', { name: 'Indent' }));
    expect(editor.__chain.sinkListItem).toHaveBeenCalledWith('listItem');
    expect(editor.__chain.insertContentAt).toHaveBeenCalled();
  });
});
