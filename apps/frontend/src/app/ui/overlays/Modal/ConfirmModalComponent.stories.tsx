import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';

import ConfirmModal from './ConfirmModal';

/**
 * The raw dialog `useConfirm` renders once its promise resolves an options
 * object. `ConfirmModal.stories.tsx` in this same directory covers the hook -
 * the promise flow, the resolve/reject timing - by driving it through a live
 * `useConfirm()` call. This file covers the other half: the dialog itself,
 * with a fixed `options` object, so its layout and the two tone variants can
 * be reviewed without wiring up the hook.
 */
const confirmModalMeta = {
  title: 'Overlays/Modal/ConfirmModalComponent',
  component: ConfirmModal,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The dialog body for a promise-based confirm, replacing the browser native ' +
          'confirm(). `tone: "danger"` swaps the confirm button for the Delete style; ' +
          'both tones dismiss the same way, by backdrop click, Escape, or the close button.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    onResolve: { control: false },
  },
  args: {
    options: {
      title: 'Delete this room?',
      body: 'Removing it takes the room off every future appointment. This cannot be undone.',
      tone: 'danger',
    },
    onResolve: fn(),
  },
} satisfies Meta<typeof ConfirmModal>;

export default confirmModalMeta;
type ConfirmModalStory = StoryObj<typeof confirmModalMeta>;

export const Danger: ConfirmModalStory = {};

export const Default: ConfirmModalStory = {
  args: {
    options: {
      title: 'Leave without saving?',
      body: 'Your changes to this form have not been saved yet.',
      tone: 'default',
    },
  },
};

export const CustomLabels: ConfirmModalStory = {
  name: 'Custom confirm/cancel labels',
  args: {
    options: {
      title: 'Send this invoice?',
      body: 'The client will receive an email with the payment link.',
      confirmLabel: 'Send invoice',
      cancelLabel: 'Not yet',
      tone: 'default',
    },
  },
};
