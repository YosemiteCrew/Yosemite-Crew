import React from 'react';
import { render, screen } from '@testing-library/react';

import { PluginContributionsContext } from '@/app/features/plugins/PluginContributionsContext';
import PluginSlot from '@/app/features/plugins/PluginSlot';
import {
  EXTENSION_POINTS,
  contributionsFor,
  type PluginContribution,
} from '@/app/features/plugins/extensionPoints';

const contribution = (overrides: Partial<PluginContribution>): PluginContribution => ({
  pluginId: 'sample-plugin',
  pluginName: 'Sample plugin',
  point: 'appointment.workspace.panel',
  title: 'Sample panel',
  url: 'https://plugin.example/panel',
  ...overrides,
});

const renderSlot = (
  point: keyof typeof EXTENSION_POINTS,
  contributions: readonly PluginContribution[]
) =>
  render(
    <PluginContributionsContext.Provider value={contributions}>
      <PluginSlot point={point} />
    </PluginContributionsContext.Provider>
  );

describe('contributionsFor', () => {
  it('keeps only contributions for the requested point', () => {
    const list = [
      contribution({ title: 'Workspace panel' }),
      contribution({ point: 'forms.configuration.panel', title: 'Forms panel' }),
    ];
    expect(contributionsFor('forms.configuration.panel', list).map((c) => c.title)).toEqual([
      'Forms panel',
    ]);
  });

  it('drops contributions whose URL is not https or does not parse', () => {
    const list = [
      contribution({ title: 'plain http', url: 'http://plugin.example/panel' }),
      contribution({ title: 'script url', url: 'javascript:alert(1)' }),
      contribution({ title: 'relative', url: '/panel' }),
      contribution({ title: 'kept' }),
    ];
    expect(contributionsFor('appointment.workspace.panel', list).map((c) => c.title)).toEqual([
      'kept',
    ]);
  });

  it('ignores a point that was never declared', () => {
    const list = [contribution({ point: 'billing.invoice.panel' })];
    expect(contributionsFor('appointment.workspace.panel', list)).toEqual([]);
  });

  it('declares a panel and an action for appointments and form configuration', () => {
    expect(EXTENSION_POINTS).toEqual({
      'appointment.workspace.panel': { kind: 'panel', label: 'Appointment workspace' },
      'appointment.workspace.action': { kind: 'action', label: 'Appointment workspace' },
      'forms.configuration.panel': { kind: 'panel', label: 'Form configuration' },
      'forms.configuration.action': { kind: 'action', label: 'Form configuration' },
    });
  });
});

describe('PluginSlot', () => {
  it('renders nothing without an installed plugin provider', () => {
    const { container } = render(<PluginSlot point="appointment.workspace.panel" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when no contribution targets the point', () => {
    const { container } = renderSlot('forms.configuration.panel', [contribution({})]);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a panel as a sandboxed frame without same-origin access', () => {
    renderSlot('appointment.workspace.panel', [contribution({})]);
    const frame = screen.getByTitle('Sample panel');
    expect(frame.tagName).toBe('IFRAME');
    expect(frame).toHaveAttribute('src', 'https://plugin.example/panel');
    expect(frame).toHaveAttribute('sandbox', 'allow-scripts allow-forms');
    expect(frame).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(screen.getByRole('region', { name: 'Sample panel' })).toHaveTextContent('Sample plugin');
  });

  it('renders an action as a link that opens in a new tab without an opener', () => {
    renderSlot('forms.configuration.action', [
      contribution({
        point: 'forms.configuration.action',
        title: 'Import from plugin',
        url: 'https://plugin.example/import',
      }),
    ]);
    const link = screen.getByRole('link', { name: 'Import from plugin' });
    expect(link).toHaveAttribute('href', 'https://plugin.example/import');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(document.querySelector('iframe')).toBeNull();
  });
});
