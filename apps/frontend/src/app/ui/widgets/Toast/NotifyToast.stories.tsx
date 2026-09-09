import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import 'react-toastify/dist/ReactToastify.css';
import NotifyToast from './NotifyToast';

type NotifyToastProps = ComponentProps<typeof NotifyToast>;

/**
 * `toastProps` is react-toastify's own runtime bag (position, transition,
 * progress state). `NotifyToast` never reads it, so the stories hand over an
 * empty object typed off the component's own props rather than reconstructing
 * a container the story does not mount.
 */
const TOAST_PROPS = {} as NotifyToastProps['toastProps'];

const notifyToastMeta = {
  title: 'Widgets/Toast/NotifyToast',
  component: NotifyToast,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Body every runtime toast renders, shared by all four `toast.<tone>()` call sites ' +
          '(`ErrorToast`, `Warning`, `Info`, `Success` each just fix the `tone` prop and forward ' +
          'the rest). A 32px tinted disc carries the tone glyph, next to a 13.5px/700 `--ink` ' +
          'title, an optional 12.5px `--ink-muted` detail line, and the shared round Close ' +
          'control. The warm-glass card around it comes from the `.Toastify__toast` override in ' +
          '`globals.css`; the decorator reproduces that container so the stories show the toast ' +
          'at its real width rather than free-floating. The tone tokens flip with ' +
          '`html[data-theme="dark"]`, so no per-theme branch lives in the component.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    tone: { control: 'radio', options: ['success', 'error', 'info', 'warning'] },
  },
  args: {
    tone: 'success',
    isPaused: false,
    toastProps: TOAST_PROPS,
    closeToast: fn(),
    data: {
      title: 'Appointment booked',
      text: 'Max - Peralta, today at 11:30 AM with Tim Apple.',
    },
  },
  decorators: [
    (Story) => (
      <div className="Toastify">
        <div className="Toastify__toast">
          <Story />
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof NotifyToast>;

export default notifyToastMeta;
type NotifyToastStory = StoryObj<typeof notifyToastMeta>;

export const Default: NotifyToastStory = {};

export const ErrorTone: NotifyToastStory = {
  name: 'Error tone',
  args: {
    tone: 'error',
    data: {
      title: 'Could not save appointment',
      text: 'The slot was taken while you were editing.',
    },
  },
};

export const WarningTone: NotifyToastStory = {
  name: 'Warning tone',
  args: {
    tone: 'warning',
    data: {
      title: 'Slot unavailable',
      text: 'This time is outside available hours. Please select a different slot.',
    },
  },
};

export const InfoTone: NotifyToastStory = {
  name: 'Info tone',
  args: {
    tone: 'info',
    data: {
      title: 'Results ready',
      text: 'IDEXX filed the haematology panel to the patient.',
    },
  },
};

export const TitleOnly: NotifyToastStory = {
  name: 'Title only',
  args: {
    data: { title: 'Draft saved', text: '' },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Callers that have nothing to add pass an empty `text`. The detail line does not ' +
          'render at all, so the toast shrinks to the title-only height instead of leaving a gap.',
      },
    },
  },
};
