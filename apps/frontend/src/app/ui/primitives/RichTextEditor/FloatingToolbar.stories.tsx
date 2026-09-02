import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import type { Editor } from '@tiptap/react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import FloatingToolbar from './FloatingToolbar';
import './RichTextEditor.css';

/* The bar is `display: none` until `.yc-rte-field:focus-within`. These stories
   seed the caret without taking DOM focus (see the note above `caretInside`), and
   only one field on a page could hold it anyway - on the docs page that would
   leave every field collapsed and the active treatments this file exists to show
   invisible. Pinned open through a harness-scoped class, so the real focus gate
   in RichTextEditor.css is untouched and RichTextEditor's own stories still prove
   it. */
const PIN_BAR_OPEN = '.yc-sb-bar-open .yc-rte-toolbar { display: flex; }';

/* Both seeds set the selection WITHOUT `.focus()`, and that is load-bearing.
   tiptap's focus command treats any touch-capable Mac as iOS (`navigator.userAgent
   .includes('Mac') && 'ontouchend' in document`) and focuses the contenteditable
   synchronously, mid-chain; ProseMirror reads the DOM selection and dispatches its
   own transaction, and the chain's transaction - built from the state before that -
   then throws "Applying a mismatched transaction" and takes the story down with it.
   The runner drives Chromium with `hasTouch: true`, so this crashed on every run
   here and on none locally. Nothing is lost by skipping it: the bar reads the
   editor's selection, not DOM focus, and the buttons run `.focus()` themselves. */

/**
 * Puts the caret one character into the first occurrence of `word`, so the
 * toolbar renders against the marks and the block that word really sits in.
 * The position is looked up rather than hard-coded: a literal offset drifts into
 * the neighbouring node the moment the fixture copy is edited, and the story
 * still passes because every button simply reports "off".
 */
const caretInside =
  (word: string) =>
  (editor: Editor): void => {
    let pos = 0;
    editor.state.doc.descendants((node, at) => {
      if (!pos && node.isText && node.text?.includes(word)) {
        pos = at + node.text.indexOf(word) + 1;
      }
    });
    editor.commands.setTextSelection(pos || 1);
  };

/** Selects `word` outright - the state the mark buttons and the indent branch
 *  behave differently in, because a range has something to wrap or to push. */
const selectWord =
  (word: string) =>
  (editor: Editor): void => {
    let from = 0;
    editor.state.doc.descendants((node, at) => {
      if (!from && node.isText && node.text?.includes(word)) {
        from = at + node.text.indexOf(word);
      }
    });
    editor.commands.setTextSelection({ from: from || 1, to: (from || 1) + word.length });
  };

type HarnessProps = {
  /** The note the caret sits in. Parsed by tiptap, so it has to be real HTML. */
  html: string;
  /** Places the selection before the toolbar's first render. */
  seed: (editor: Editor) => void;
};

/**
 * `FloatingToolbar` takes a live `Editor` and calls `isActive` / `chain()` while
 * it renders, so it cannot be storied from args alone. This harness rebuilds the
 * exact field `RichTextEditor` puts it in - same extensions, same wrapper
 * classes - and seeds the selection, which is the only input the bar has.
 */
/**
 * The editor the harness last mounted, so a play function can assert the
 * selection tiptap actually holds.
 *
 * `getSelection()` reads the *browser's* selection, which tiptap only mirrors
 * into the DOM while the editor view has focus - and clicking a toolbar button
 * moves focus off it. That made the selection assertions depend on whether the
 * story's iframe happened to be focused, which is why they failed under
 * concurrent load and passed when run alone.
 */
let liveEditor: Editor | null = null;

const ToolbarHarness = ({ html, seed }: HarnessProps) => {
  /* The SOAP page holds the note's HTML in state and feeds it back as `value`,
     so a document change re-renders the field - and that re-render is the only
     thing that refreshes the bar. `useEditor` in tiptap 3 does not re-render its
     host on a transaction unless `shouldRerenderOnTransaction` is set, and
     RichTextEditor does not set it. Mirrored here rather than papered over with
     a subscription, so no story can show an active state the product cannot
     reach: a caret MOVED into bold text lights nothing up until the document
     itself changes. */
  const [, echoValue] = useState(html);
  const [seeded, setSeeded] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    // The same extension list and the same cast as RichTextEditor: the two
    // tiptap minors resolved in this repo disagree on the extension type.
    extensions: [StarterKit.configure({ underline: false }), Underline] as never,
    content: html,
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': 'Notes',
        class: 'yc-rte-content',
      },
    },
    onUpdate: ({ editor: instance }) => echoValue(instance.getHTML()),
    /* The toolbar reads editor state DURING render, so the selection has to be
       in place before its first one. Seeding afterwards would leave every
       aria-pressed showing the empty-document answer with no re-render to
       correct it - which is exactly how a broken active state would slip
       through.

       Seeded from tiptap's own `onCreate` rather than from an effect: setting
       state synchronously inside an effect trips `react-hooks` and cascades a
       render, while a library callback is an event, so the flag both gates the
       mount and provides the one re-render the bar needs. */
    onCreate: ({ editor: instance }) => {
      seed(instance);
      liveEditor = instance;
      setSeeded(true);
    },
  });

  return (
    <div className="yc-rte-field yc-sb-bar-open" style={{ maxWidth: 520 }}>
      {editor && seeded && <FloatingToolbar editor={editor} />}
      <div className="yc-rte-body">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

const meta = {
  title: 'Primitives/FloatingToolbar',
  component: ToolbarHarness,
  decorators: [
    (Story) => (
      <>
        <style>{PIN_BAR_OPEN}</style>
        <Story />
      </>
    ),
  ],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The docked B / I / U | bulleted-list / indent bar inside the rich-text field. Its state ' +
          'is not a prop: every button asks the live editor whether its mark is active at the ' +
          'caret, so the only way to draw a pressed button is to hand it an editor whose selection ' +
          'is already inside that mark. `RichTextEditor.stories.tsx` reveals the bar but never ' +
          'applies a mark, so the pressed treatment (`--inset` pill, `--ink` glyph) and the list ' +
          'and indent branches had never been rendered.\n\n' +
          'Two behaviours here are easy to break and impossible to see in a static frame. ' +
          '**Indent is two different commands**: inside a list item it sinks the item into a ' +
          'nested list, and everywhere else it inserts four non-breaking spaces at the START of ' +
          'the block and shifts the selection right - it must not overwrite the selected text, ' +
          'which is what a plain `insertContent` would do. And **sinking only works when there is ' +
          'a list item above to sink under**: on the first item of a list the sink fails and the ' +
          'nbsp branch runs instead, so a one-item fixture would have proved nothing.\n\n' +
          '`Indent` is a verb, not a state, so its `isActive` is hardcoded `false` and it must ' +
          'never report itself pressed - including while the caret is in a list.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    html: '<p>Bright, alert, responsive. Eating and drinking normally.</p>',
    seed: caretInside('Eating'),
  },
} satisfies Meta<typeof ToolbarHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The bar in one row: [Bold Italic Underline] | [Bulleted list Indent] "editing". */
const barButtons = (canvasElement: HTMLElement) => {
  const toolbar = within(canvasElement).getByRole('toolbar', { name: 'Text formatting' });
  const [bold, italic, underline, bulletList, indent] = within(toolbar).getAllByRole('button');
  return { toolbar, bold, italic, underline, bulletList, indent };
};

const editorHtml = (canvasElement: HTMLElement) =>
  canvasElement.querySelector('.yc-rte-content')?.innerHTML ?? '';

export const Default: Story = {
  name: 'Caret in plain text (nothing pressed)',
  play: async ({ canvasElement }) => {
    const { toolbar, bold, italic, underline, bulletList, indent } = barButtons(canvasElement);
    const buttons = [bold, italic, underline, bulletList, indent];

    // Label order is the design's grouping and the only thing telling the five
    // near-identical icons apart to a screen reader.
    await expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Bold',
      'Italic',
      'Underline',
      'Bulleted list',
      'Indent',
    ]);
    // Every button carries aria-pressed even when off. A button that dropped the
    // attribute entirely would look identical and announce nothing, so read the
    // attribute rather than asserting "not pressed".
    await expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual([
      'false',
      'false',
      'false',
      'false',
      'false',
    ]);

    // The hairline divider separates the mark group from the block group. The
    // component builds that split by destructuring the button array, so a
    // reorder would move the divider without changing a single label.
    const divider = toolbar.querySelector('.yc-rte-toolbar-divider') as HTMLElement;
    await expect(divider.getBoundingClientRect().left).toBeGreaterThanOrEqual(
      underline.getBoundingClientRect().right
    );
    await expect(divider.getBoundingClientRect().right).toBeLessThanOrEqual(
      bulletList.getBoundingClientRect().left
    );

    // 26x26 hit target from RichTextEditor.css. Measured rather than matched on
    // a class name, because the class can survive the rule being deleted.
    const box = bold.getBoundingClientRect();
    await expect(Math.round(box.width)).toBe(26);
    await expect(Math.round(box.height)).toBe(26);
  },
};

export const MarksActive: Story = {
  name: 'Caret inside bold + italic + underline',
  args: {
    html: '<p>Bright, alert and <strong><em><u>responsive</u></em></strong> on arrival.</p>',
    seed: caretInside('responsive'),
  },
  play: async ({ canvasElement }) => {
    const { bold, italic, underline, bulletList, indent } = barButtons(canvasElement);

    // All three marks are live at the caret, so all three report pressed. The
    // block controls must not: they answer for the paragraph, not the marks.
    await expect(bold).toHaveAttribute('aria-pressed', 'true');
    await expect(italic).toHaveAttribute('aria-pressed', 'true');
    await expect(underline).toHaveAttribute('aria-pressed', 'true');
    await expect(bulletList).toHaveAttribute('aria-pressed', 'false');
    await expect(indent).toHaveAttribute('aria-pressed', 'false');

    /* The pressed state is drawn ONLY by the `[aria-pressed='true']` rule -
       filled `--inset` pill, `--ink` glyph. Nothing in the markup differs, so if
       that selector is dropped the aria contract still passes and the bar goes
       visually dead. Compare the painted background against a resting button
       rather than reading a class. */
    const painted = (el: HTMLElement) => globalThis.getComputedStyle(el).backgroundColor;
    await expect(painted(bulletList)).toBe('rgba(0, 0, 0, 0)');
    await expect(painted(bold)).not.toBe('rgba(0, 0, 0, 0)');
    await expect(painted(bold)).not.toBe(painted(bulletList));
  },
};

export const IndentSinksAListItem: Story = {
  name: 'Caret in a list: indent sinks the item',
  args: {
    html: '<ul><li><p>Ears cleaned</p></li><li><p>Nails trimmed</p></li></ul>',
    seed: caretInside('Nails'),
  },
  play: async ({ canvasElement }) => {
    const { bold, bulletList, indent } = barButtons(canvasElement);

    await expect(bulletList).toHaveAttribute('aria-pressed', 'true');
    await expect(bold).toHaveAttribute('aria-pressed', 'false');
    // Indent runs a command, it never describes a state - so it stays unpressed
    // in the one place someone would be tempted to light it up.
    await expect(indent).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(indent);

    /* The second item sinks into a nested list. The fallback branch would have
       inserted four non-breaking spaces into the text instead, which looks
       almost the same on screen and is not a list at all - so assert the
       structure AND the absence of the nbsp run. */
    await waitFor(() =>
      expect(canvasElement.querySelector('.yc-rte-content li ul')).not.toBeNull()
    );
    await expect(editorHtml(canvasElement)).not.toContain('&nbsp;');
    await expect(canvasElement.querySelector('.yc-rte-content')?.textContent).toContain(
      'Nails trimmed'
    );
  },
};

export const IndentPushesAParagraph: Story = {
  name: 'Indent in a paragraph inserts the nbsp run',
  args: {
    html: '<p>Eating and drinking normally.</p>',
    seed: selectWord('drinking'),
  },
  play: async ({ canvasElement }) => {
    const { indent } = barButtons(canvasElement);

    await userEvent.click(indent);

    // Four non-breaking spaces at the START of the block, not at the caret.
    await waitFor(() => expect(editorHtml(canvasElement)).toContain('&nbsp;&nbsp;&nbsp;&nbsp;'));
    /* The selection survives. `insertContent` would have replaced the selected
       word with the spaces - the failure the component's own comment is guarding
       against, and one that leaves a plausible-looking indented line behind. */
    await expect(canvasElement.querySelector('.yc-rte-content')?.textContent).toContain(
      'Eating and drinking normally.'
    );
    /* Asserted from the editor rather than from `getSelection()`: the selected
       range is what `insertContent` would have destroyed, and tiptap holds it
       whether or not the view still has DOM focus. */
    const { from, to } = liveEditor!.state.selection;
    await expect(liveEditor!.state.doc.textBetween(from, to)).toBe('drinking');
  },
};

export const TogglingMarks: Story = {
  name: 'Each mark button toggles its own mark',
  args: {
    html: '<p>Bright, alert, responsive.</p>',
    seed: selectWord('responsive'),
  },
  play: async ({ canvasElement }) => {
    const { bold, italic, underline } = barButtons(canvasElement);

    /* Three adjacent buttons wired to three different marks through the same
       `toggleMark` call. A copy-paste slip binds two of them to the same mark,
       and the bar still looks and announces exactly right. */
    await userEvent.click(bold);
    await userEvent.click(italic);
    await userEvent.click(underline);

    const content = () => canvasElement.querySelector('.yc-rte-content');
    await waitFor(() => expect(content()?.querySelector('strong')?.textContent).toBe('responsive'));
    await expect(content()?.querySelector('em')?.textContent).toBe('responsive');
    await expect(content()?.querySelector('u')?.textContent).toBe('responsive');

    /* And the bar catches up, because each toggle changed the document and the
       controlled parent re-rendered. Nothing in the toolbar subscribes to the
       editor, so this is the whole mechanism - see the harness note above. */
    await waitFor(() => expect(bold).toHaveAttribute('aria-pressed', 'true'));
  },
};

export const Phone: Story = {
  name: 'Phone: the bar stays one row',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const { toolbar, bold, italic, underline, bulletList, indent } = barButtons(canvasElement);
    const buttons = [bold, italic, underline, bulletList, indent];

    // 375px is the narrowest the field is ever drawn at. Five 26px buttons plus
    // the "editing" hint have to stay on one line: a wrap would push the bar
    // over the first line of the note.
    const top = Math.round(bold.getBoundingClientRect().top);
    await expect(buttons.map((b) => Math.round(b.getBoundingClientRect().top))).toEqual(
      buttons.map(() => top)
    );
    await expect(toolbar.scrollWidth).toBeLessThanOrEqual(toolbar.clientWidth);
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};
